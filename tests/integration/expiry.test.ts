import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { AppDatabase, setTestDatabase, repository } from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';
import { sessionStore } from '../../src/server/session.js';
import { SESSION_COOKIE_NAME } from '../../src/server/authz.js';
import { runDeadlineReconciliation, isDeadlineElapsed } from '../../src/server/domain/expiry.js';
import { getEntityAuditTrail } from '../../src/server/domain/audit.js';

describe('Deadline Reconciliation, Audit Timeline & In-App Messages (T-09)', () => {
  let app: ReturnType<typeof createApp>;
  let testDb: AppDatabase;

  beforeEach(async () => {
    testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
    sessionStore.clearAll();
    await runDemoSeed();
    app = createApp();
  });

  function publishDonationWithDeadline(portions: number, deadlineIso: string): string {
    const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
    const now = new Date();
    const donation = repository.createDonation(
      {
        id: crypto.randomUUID(),
        donorOrganizationId: donorUser.organizationId!,
        category: 'cooked',
        description: `${portions} portion meal package`,
        offeredPortions: portions,
        preparedAt: new Date(now.getTime() - 3600000).toISOString(),
        pickupDeadline: deadlineIso,
        pickupAddress: 'Annapurna Kitchen Main Counter',
        pickupLatitude: 19.8700,
        pickupLongitude: 75.3200,
        handlingDeclaredAt: now.toISOString(),
        declarationSnapshot: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
        status: 'Available',
      },
      'corr-expiry-test',
      donorUser.id
    );
    return donation.id;
  }

  describe('isDeadlineElapsed helper', () => {
    it('returns true when deadline is in the past', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(isDeadlineElapsed(past)).toBe(true);
    });

    it('returns false when deadline is in the future', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(isDeadlineElapsed(future)).toBe(false);
    });
  });

  describe('Synchronous Database Clock Expiry Guard', () => {
    it('synchronously blocks claim attempt when donation has elapsed pickup deadline', async () => {
      // Create donation with future deadline, then elapse it
      const initialDeadline = new Date(Date.now() + 600000).toISOString();
      const expiredDonationId = publishDonationWithDeadline(25, initialDeadline);

      const pastDeadline = new Date(Date.now() - 600000).toISOString();
      testDb.db.prepare('UPDATE donations SET pickup_deadline = ? WHERE id = ?').run(pastDeadline, expiredDonationId);

      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const res = await request(app)
        .post(`/api/ngo/donations/${expiredDonationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      // Synchronous clock guard returns 410 Gone or 409 Conflict
      expect([409, 410]).toContain(res.status);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-036: POST /api/internal/reconcile-expired (T-API-EP036)', () => {
    it('reconciles expired listings and releases capacity for claimed food past deadline', async () => {
      // Step 1: NGO claims a donation
      const soonDeadline = new Date(Date.now() + 1000).toISOString(); // 1 second from now
      const donId = publishDonationWithDeadline(30, soonDeadline);

      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const claimRes = await request(app)
        .post(`/api/ngo/donations/${donId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      expect(claimRes.status).toBe(201);

      // Verify NGO capacity was consumed: 60 - 30 = 30 remaining
      const capBefore = repository.getNgoCapacity(ngoA.organizationId!);
      expect(capBefore.availableRemainingPortions).toBe(30);

      // Step 2: Simulate passage of time past deadline
      const futureSimulatedNow = new Date(Date.now() + 5000).toISOString();
      const outcome = runDeadlineReconciliation(futureSimulatedNow);
      expect(outcome.reconciledCount).toBeGreaterThanOrEqual(1);

      // Step 3: Verify donation and claim transitioned to Expired
      const donRecord = repository.getDonationById(donId)!;
      expect(donRecord.status).toBe('Expired');

      const claimRecord = repository.getClaimById(claimRes.body.data.id)!;
      expect(claimRecord.status).toBe('Expired');

      // Step 4: Verify NGO capacity released back: 60 available
      const capAfter = repository.getNgoCapacity(ngoA.organizationId!);
      expect(capAfter.availableRemainingPortions).toBe(60);

      // Step 5: Verify immutable audit trail contains expire_reconciliation
      const trail = getEntityAuditTrail('Donation', donId);
      expect(trail.some((a) => a.eventType === 'expire_reconciliation')).toBe(true);

      // Step 6: Verify in-app notifications delivered to both donor and NGO
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const donorNotes = repository.listNotificationsForUser(donorUser.id);
      expect(donorNotes.items.some((n) => n.kind === 'expired' && n.objectId === donId)).toBe(true);

      const ngoNotes = repository.listNotificationsForUser(ngoA.id);
      expect(ngoNotes.items.some((n) => n.kind === 'expired' && n.objectId === donId)).toBe(true);
    });

    it('returns 204 when invoked with valid internalTaskNonce', async () => {
      const res = await request(app)
        .post('/api/internal/reconcile-expired')
        .send({ internalTaskNonce: 'cron-job-internal-nonce-12345' });

      expect(res.status).toBe(204);
    });

    it('rejects public client roles (donor, ngo, coordinator) with 403 Forbidden', async () => {
      const coordUser = repository.getUserByEmail('coordinator@aaharlink.example')!;
      const session = sessionStore.createSession(coordUser.id, coordUser.role, null);

      const res = await request(app)
        .post('/api/internal/reconcile-expired')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .send({ internalTaskNonce: 'nonce' });

      expect(res.status).toBe(403);
    });

    it('rejects missing or empty internalTaskNonce with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/internal/reconcile-expired')
        .send({});

      expect(res.status).toBe(401);
    });
  });
});
