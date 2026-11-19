import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { AppDatabase, setTestDatabase, repository } from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';
import { sessionStore } from '../../src/server/session.js';
import { SESSION_COOKIE_NAME } from '../../src/server/authz.js';

describe('NGO Claim Lifecycle, Concurrency Guards & Atomic Handover (T-07)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
    sessionStore.clearAll();
    await runDemoSeed();
    app = createApp();
  });

  // Helper to publish a fresh 40-portion donation
  function publishTestDonation(portions: number = 40): string {
    const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
    const now = new Date();
    const donation = repository.createDonation(
      {
        id: crypto.randomUUID(),
        donorOrganizationId: donorUser.organizationId!,
        category: 'cooked',
        description: `${portions} freshly cooked meal packets with rice and dal`,
        offeredPortions: portions,
        preparedAt: new Date(now.getTime() - 1800000).toISOString(),
        pickupDeadline: new Date(now.getTime() + 14400000).toISOString(),
        pickupAddress: 'Annapurna Kitchen Main Gate, Station Road',
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
      'corr-publish-test',
      donorUser.id
    );
    return donation.id;
  }

  // --------------------------------------------------------------------------
  // EP-017: GET /api/ngo/dashboard (T-API-EP017)
  // --------------------------------------------------------------------------
  describe('EP-017: GET /api/ngo/dashboard', () => {
    it('returns dashboard data for verified NGO', async () => {
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .get('/api/ngo/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.currentCapacity).toBeDefined();
      expect(res.body.data.currentCapacity.maxPortions).toBe(60);
      expect(typeof res.body.data.availableDonationsNearbyCount).toBe('number');
    });

    it('denies donor role with 403 Forbidden', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .get('/api/ngo/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(403);
    });

    it('denies unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/ngo/dashboard');
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // EP-018: GET /api/ngo/discover (T-API-EP018)
  // --------------------------------------------------------------------------
  describe('EP-018: GET /api/ngo/discover', () => {
    it('discovers available food without disclosing exact donor address or contact', async () => {
      publishTestDonation(40);
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .get('/api/ngo/discover')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      // Verify no PII leak
      for (const item of res.body.data.items) {
        expect(item.pickupAddress).toBeUndefined();
        expect(item.donorContactPhone).toBeUndefined();
        expect(item.straightLineDistanceKm).toBeDefined();
        expect(item.approximateCity).toBeDefined();
      }
    });

    it('supports category, minPortions, and sort filters', async () => {
      publishTestDonation(40);
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .get('/api/ngo/discover?category=cooked&minPortions=10&sort=urgency')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.every((i: { category: string }) => i.category === 'cooked')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EP-019: GET /api/ngo/donations/:id (T-API-EP019)
  // --------------------------------------------------------------------------
  describe('EP-019: GET /api/ngo/donations/:id', () => {
    it('returns preview with capacity eligibility and distance for verified NGO', async () => {
      const donationId = publishTestDonation(40);
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .get(`/api/ngo/donations/${donationId}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(donationId);
      expect(res.body.data.eligibleForMyCapacity).toBe(true);
      expect(res.body.data.pickupAddress).toBeUndefined(); // Zero contact leak prior to claim
    });

    it('safely presents expired donation without private contact details', async () => {
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      // The demo seed creates an expired donation
      const donations = repository.listAllDonationsForCoordinator('Expired');
      const expiredDonation = donations.items[0];

      if (expiredDonation) {
        const res = await request(app)
          .get(`/api/ngo/donations/${expiredDonation.id}`)
          .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('Expired');
        expect(res.body.data.eligibleForMyCapacity).toBe(false);
        expect(res.body.data.ineligibleReason).toBeDefined();
        expect(res.body.data.pickupAddress).toBeUndefined();
      }
    });
  });

  // --------------------------------------------------------------------------
  // EP-020: POST /api/ngo/donations/:id/claims (T-API-EP020) — 40-Portion Race
  // --------------------------------------------------------------------------
  describe('EP-020: POST /api/ngo/donations/:id/claims (40-Portion Concurrency Guard)', () => {
    it('yields exactly one winner (201) and one conflict (409) under simultaneous claims', async () => {
      const donationId = publishTestDonation(40);

      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const ngoB = repository.getUserByEmail('ngo-b@aaharlink.example')!;

      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);
      const sessionB = sessionStore.createSession(ngoB.id, ngoB.role, ngoB.organizationId);

      // Both NGOs attempt to claim the exact same 40-portion donation with expectedVersion: 1
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/ngo/donations/${donationId}/claims`)
          .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
          .set('x-csrf-token', sessionA.csrfToken)
          .send({ assessedDeclaration: true, expectedVersion: 1 }),
        request(app)
          .post(`/api/ngo/donations/${donationId}/claims`)
          .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionB.id}`])
          .set('x-csrf-token', sessionB.csrfToken)
          .send({ assessedDeclaration: true, expectedVersion: 1 }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const winnerRes = resA.status === 201 ? resA : resB;
      const loserRes = resA.status === 409 ? resA : resB;

      // Winner receives full OwnClaimDetail including pickup address and contact
      expect(winnerRes.body.ok).toBe(true);
      expect(winnerRes.body.data.claimedPortions).toBe(40);
      expect(winnerRes.body.data.pickupAddress).toBe('Annapurna Kitchen Main Gate, Station Road');
      expect(winnerRes.body.data.donorContactPhone).toBeDefined();

      // Loser receives 409 Conflict with ZERO contact leak
      expect(loserRes.body.ok).toBe(false);
      expect(loserRes.body.error.code).toBe('CONFLICT');
      expect(loserRes.body.data).toBeUndefined();

      // Exactly ONE active claim in the database
      const activeClaim = repository.getActiveClaimForDonation(donationId);
      expect(activeClaim).not.toBeNull();
      expect(activeClaim?.claimedPortions).toBe(40);
    });

    it('rejects claim when donation portion count exceeds NGO remaining capacity', async () => {
      // NGO A has capacity 60. Let's create a 75-portion donation
      const hugeDonationId = publishTestDonation(75);
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const res = await request(app)
        .post(`/api/ngo/donations/${hugeDonationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      expect(res.status).toBe(422);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.message).toContain('exceeds your current capacity');
    });

    it('prevents donor from claiming own donation with 403 Forbidden', async () => {
      const donationId = publishTestDonation(40);
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      // Even if role was changed or session manipulated
      const session = sessionStore.createSession(donorUser.id, 'ngo', donorUser.organizationId);

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('cannot claim your own donation');
    });
  });

  // --------------------------------------------------------------------------
  // EP-021: GET /api/ngo/claims (T-API-EP021)
  // --------------------------------------------------------------------------
  describe('EP-021: GET /api/ngo/claims', () => {
    it('lists own claims for NGO', async () => {
      const donationId = publishTestDonation(40);
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      // Claim it first
      await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      const res = await request(app)
        .get('/api/ngo/claims')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].claimedPortions).toBe(40);
    });
  });

  // --------------------------------------------------------------------------
  // EP-022: GET /api/ngo/claims/:id (T-API-EP022)
  // --------------------------------------------------------------------------
  describe('EP-022: GET /api/ngo/claims/:id', () => {
    it('returns own claim details including pickup address and contact', async () => {
      const donationId = publishTestDonation(40);
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const claimRes = await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      const claimId = claimRes.body.data.id;

      const res = await request(app)
        .get(`/api/ngo/claims/${claimId}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.pickupAddress).toBe('Annapurna Kitchen Main Gate, Station Road');
      expect(res.body.data.donorContactPhone).toBeDefined();
    });

    it('returns 404 to another NGO attempting to view foreign claim', async () => {
      const donationId = publishTestDonation(40);
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const ngoB = repository.getUserByEmail('ngo-b@aaharlink.example')!;

      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);
      const sessionB = sessionStore.createSession(ngoB.id, ngoB.role, ngoB.organizationId);

      const claimRes = await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      const claimId = claimRes.body.data.id;

      // NGO B tries to view NGO A's claim
      const res = await request(app)
        .get(`/api/ngo/claims/${claimId}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionB.id}`]);

      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // EP-023: POST /api/ngo/claims/:id/cancel (T-API-EP023)
  // --------------------------------------------------------------------------
  describe('EP-023: POST /api/ngo/claims/:id/cancel', () => {
    it('cancels active claim with reason and restores donation to Available', async () => {
      const donationId = publishTestDonation(40);
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const claimRes = await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      const claimId = claimRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/ngo/claims/${claimId}/cancel`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({
          reason: 'Our transport vehicle experienced unexpected mechanical breakdown.',
          expectedVersion: 1,
        });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.ok).toBe(true);
      expect(cancelRes.body.data.status).toBe('Cancelled');

      // Verify donation is restored to Available
      const restoredDonation = repository.getDonationById(donationId);
      expect(restoredDonation?.status).toBe('Available');
    });

    it('rejects cancellation without reason or with insufficient reason length', async () => {
      const donationId = publishTestDonation(40);
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const claimRes = await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      const claimId = claimRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/ngo/claims/${claimId}/cancel`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({
          reason: 'Too short', // less than 10 characters
          expectedVersion: 1,
        });

      expect(cancelRes.status).toBe(422);
      expect(cancelRes.body.ok).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // EP-024: POST /api/ngo/claims/:id/collect (T-API-EP024) — Handover & Audit
  // --------------------------------------------------------------------------
  describe('EP-024: POST /api/ngo/claims/:id/collect (Atomic Handover & Completion)', () => {
    it('executes full 8-step handover collection with valid code and atomic audit', async () => {
      // Step 1: Donor publishes 40 portions
      const donationId = publishTestDonation(40);

      // Step 2: NGO A claims 40 portions
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const sessionA = sessionStore.createSession(ngoA.id, ngoA.role, ngoA.organizationId);

      const claimRes = await request(app)
        .post(`/api/ngo/donations/${donationId}/claims`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({ assessedDeclaration: true, expectedVersion: 1 });

      expect(claimRes.status).toBe(201);
      const claimId = claimRes.body.data.id;

      // Step 3: Donor sets donation pickup ready and receives one-time 6-digit code
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const sessionDonor = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const readyRes = await request(app)
        .post(`/api/donor/donations/${donationId}/ready`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionDonor.id}`])
        .set('x-csrf-token', sessionDonor.csrfToken)
        .send({ expectedVersion: 2 }); // Claiming incremented donation version from 1 to 2

      expect(readyRes.status).toBe(200);
      const handoverCode = readyRes.body.data.handoverCode;
      expect(handoverCode).toMatch(/^\d{6}$/);

      // Step 4: NGO enters incorrect code -> rejected and decrements attempts
      const wrongCodeRes = await request(app)
        .post(`/api/ngo/claims/${claimId}/collect`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({
          handoverCode: '000000',
          actualPortions: 40,
          recipientAffirmation: true,
          expectedVersion: 2, // pickup-ready incremented claim version to 2
        });

      expect(wrongCodeRes.status).toBe(422);
      expect(wrongCodeRes.body.error.message).toContain('code is incorrect or expired');

      // Verify attempts remaining decremented
      const claimAfterFail = repository.getClaimById(claimId)!;
      expect(claimAfterFail.handoverAttempts).toBe(1);

      // Step 5: NGO enters correct code, confirms 40 portions received
      const collectRes = await request(app)
        .post(`/api/ngo/claims/${claimId}/collect`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${sessionA.id}`])
        .set('x-csrf-token', sessionA.csrfToken)
        .send({
          handoverCode,
          actualPortions: 40,
          recipientAffirmation: true,
          expectedVersion: 2,
        });

      expect(collectRes.status).toBe(200);
      expect(collectRes.body.ok).toBe(true);
      expect(collectRes.body.data.status).toBe('Completed');
      expect(collectRes.body.data.actualReceived).toBe(40);
      expect(collectRes.body.data.completedAt).toBeDefined();

      // Step 6: Verify atomic Collected and Completed audit events
      const audits = repository.listAuditEvents(50).items;
      const collectedAudit = audits.find((a) => a.eventType === 'handover_collected' && a.entityId === claimId);
      const completedDonationAudit = audits.find((a) => a.eventType === 'handover_completed' && a.entityId === donationId);

      expect(collectedAudit).toBeDefined();
      expect(collectedAudit?.fromStatus).toBe('Ready');
      expect(collectedAudit?.toStatus).toBe('Collected');

      expect(completedDonationAudit).toBeDefined();
      expect(completedDonationAudit?.fromStatus).toBe('Pickup Confirmed');
      expect(completedDonationAudit?.toStatus).toBe('Completed');

      // Step 7: Verify final database rows
      const finalDonation = repository.getDonationById(donationId)!;
      expect(finalDonation.status).toBe('Completed');
      expect(finalDonation.actualCollectedPortions).toBe(40);

      const finalClaim = repository.getClaimById(claimId)!;
      expect(finalClaim.status).toBe('Completed');
      expect(finalClaim.actualReceived).toBe(40);
    });
  });

  // --------------------------------------------------------------------------
  // EP-025: GET /api/ngo/capacity (T-API-EP025)
  // --------------------------------------------------------------------------
  describe('EP-025: GET /api/ngo/capacity', () => {
    it('returns NGO capacity profile', async () => {
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .get('/api/ngo/capacity')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.maxPortions).toBe(60);
      expect(res.body.data.operatingRadiusKm).toBe(25.0);
      expect(res.body.data.availableRemainingPortions).toBe(60);
    });
  });

  // --------------------------------------------------------------------------
  // EP-026: PATCH /api/ngo/capacity (T-API-EP026)
  // --------------------------------------------------------------------------
  describe('EP-026: PATCH /api/ngo/capacity', () => {
    it('updates NGO capacity and operating radius with optimistic version check', async () => {
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .patch('/api/ngo/capacity')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          maxPortions: 120,
          operatingRadiusKm: 35.0,
          version: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.maxPortions).toBe(120);
      expect(res.body.data.operatingRadiusKm).toBe(35.0);
      expect(res.body.data.version).toBe(2);
    });

    it('rejects update with stale version returning 409 Conflict', async () => {
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .patch('/api/ngo/capacity')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          maxPortions: 120,
          version: 999, // Stale version
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });
});
