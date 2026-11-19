import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { AppDatabase, setTestDatabase, repository } from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';
import { sessionStore } from '../../src/server/session.js';
import { SESSION_COOKIE_NAME } from '../../src/server/authz.js';

describe('Coordinator Verification, Exception Management & Derived Analytics (T-08)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
    sessionStore.clearAll();
    await runDemoSeed();
    app = createApp();
  });

  function getCoordinatorSession() {
    const coordUser = repository.getUserByEmail('coordinator@aaharlink.example')!;
    return sessionStore.createSession(coordUser.id, coordUser.role, null);
  }

  function getDonorSession() {
    const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
    return sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);
  }

  function getNgoSession() {
    const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
    return sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);
  }

  // --------------------------------------------------------------------------
  // EP-027: GET /api/coordinator/dashboard (T-API-EP027)
  // --------------------------------------------------------------------------
  describe('EP-027: GET /api/coordinator/dashboard', () => {
    it('returns operations overview metrics for coordinator', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.pendingOrganizationsCount).toBeGreaterThanOrEqual(1); // Demo seed has 1 pending NGO
      expect(res.body.data.activeDonationsCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.recentAuditEvents)).toBe(true);
    });

    it('denies non-coordinator role (Donor / NGO) with 403 Forbidden', async () => {
      const donorSession = getDonorSession();
      const resDonor = await request(app)
        .get('/api/coordinator/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${donorSession.id}`]);
      expect(resDonor.status).toBe(403);

      const ngoSession = getNgoSession();
      const resNgo = await request(app)
        .get('/api/coordinator/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${ngoSession.id}`]);
      expect(resNgo.status).toBe(403);
    });

    it('denies unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/coordinator/dashboard');
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // EP-028: GET /api/coordinator/organizations (T-API-EP028)
  // --------------------------------------------------------------------------
  describe('EP-028: GET /api/coordinator/organizations', () => {
    it('lists organizations with optional status filter', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/organizations?status=pending')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items.every((o: { status: string }) => o.status === 'pending')).toBe(true);
    });

    it('supports query search by name or city', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/organizations?q=Seva')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.some((o: { name: string }) => o.name.includes('Seva'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EP-029: GET /api/coordinator/organizations/:id (T-API-EP029)
  // --------------------------------------------------------------------------
  describe('EP-029: GET /api/coordinator/organizations/:id', () => {
    it('returns complete organization detail for coordinator inspection', async () => {
      const session = getCoordinatorSession();
      const org = repository.getOrgById('org-demo-donor')!;

      const res = await request(app)
        .get(`/api/coordinator/organizations/${org.id}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(org.id);
      expect(res.body.data.ownerEmail).toBe('donor@aaharlink.example');
      expect(res.body.data.contactPerson).toBe(org.contactPerson);
      expect(res.body.data.contactPhone).toBe(org.contactPhone);
    });

    it('returns 404 for nonexistent organization', async () => {
      const session = getCoordinatorSession();
      const res = await request(app)
        .get('/api/coordinator/organizations/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // EP-030: POST /api/coordinator/organizations/:id/decision (T-API-EP030)
  // --------------------------------------------------------------------------
  describe('EP-030: POST /api/coordinator/organizations/:id/decision', () => {
    it('verifies pending organization and records audit event with reason', async () => {
      const session = getCoordinatorSession();
      const pendingOrg = repository.getOrgById('org-demo-ngo-pending')!;
      expect(pendingOrg.status).toBe('pending');

      const res = await request(app)
        .post(`/api/coordinator/organizations/${pendingOrg.id}/decision`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'verify',
          reason: 'Reviewed valid 80G registration certificate and food handling permit.',
          expectedVersion: pendingOrg.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('verified');
      expect(res.body.data.version).toBe(pendingOrg.version + 1);

      // Verify audit log
      const audits = repository.listAuditEvents(20).items;
      const decAudit = audits.find(
        (a) => a.eventType === 'organization_decision' && a.entityId === pendingOrg.id
      );
      expect(decAudit).toBeDefined();
      expect(decAudit?.fromStatus).toBe('pending');
      expect(decAudit?.toStatus).toBe('verified');
      expect(decAudit?.reason).toContain('80G registration');
    });

    it('rejects pending organization with reason', async () => {
      const session = getCoordinatorSession();
      const pendingOrg = repository.getOrgById('org-demo-ngo-pending')!;

      const res = await request(app)
        .post(`/api/coordinator/organizations/${pendingOrg.id}/decision`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'reject',
          reason: 'Documentation provided was incomplete and contact phone unresponsive.',
          expectedVersion: pendingOrg.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('rejected');
    });

    it('suspends verified organization with reason', async () => {
      const session = getCoordinatorSession();
      const ngoOrg = repository.getOrgById('org-demo-ngo-b')!;
      expect(ngoOrg.status).toBe('verified');

      const res = await request(app)
        .post(`/api/coordinator/organizations/${ngoOrg.id}/decision`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'suspend',
          reason: 'Multiple no-show reports received from verified donor organizations.',
          expectedVersion: ngoOrg.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('suspended');
    });

    it('returns 409 Conflict when expectedVersion does not match current state', async () => {
      const session = getCoordinatorSession();
      const pendingOrg = repository.getOrgById('org-demo-ngo-pending')!;

      const res = await request(app)
        .post(`/api/coordinator/organizations/${pendingOrg.id}/decision`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'verify',
          reason: 'Valid registration documents provided by applicant.',
          expectedVersion: 999, // Mismatched version
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 409 Conflict for illegal status transition', async () => {
      const session = getCoordinatorSession();
      const donorOrg = repository.getOrgById('org-demo-donor')!;
      expect(donorOrg.status).toBe('verified');

      // Attempt to verify an already verified organization
      const res = await request(app)
        .post(`/api/coordinator/organizations/${donorOrg.id}/decision`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'verify',
          reason: 'Attempting to verify already verified organization.',
          expectedVersion: donorOrg.version,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('resolution is not allowed in the current state');
    });
  });

  // --------------------------------------------------------------------------
  // EP-031: GET /api/coordinator/donations (T-API-EP031)
  // --------------------------------------------------------------------------
  describe('EP-031: GET /api/coordinator/donations', () => {
    it('lists all donations with status and sorting options', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/donations?sort=newest')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2); // Seed has Available and Expired
    });

    it('filters donations by status (Available, Expired)', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/donations?status=Expired')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items.every((d: { status: string }) => d.status === 'Expired')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EP-032: GET /api/coordinator/donations/:id (T-API-EP032)
  // --------------------------------------------------------------------------
  describe('EP-032: GET /api/coordinator/donations/:id', () => {
    it('returns full donation detail including pickup address and audit trail', async () => {
      const session = getCoordinatorSession();
      const allDonations = repository.listAllDonationsForCoordinator();
      const don = allDonations.items[0];

      const res = await request(app)
        .get(`/api/coordinator/donations/${don.id}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(don.id);
      expect(res.body.data.pickupAddress).toBeDefined();
      expect(Array.isArray(res.body.data.auditTrail)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EP-033: POST /api/coordinator/donations/:id/resolve (T-API-EP033)
  // --------------------------------------------------------------------------
  describe('EP-033: POST /api/coordinator/donations/:id/resolve', () => {
    it('opens dispute on active donation and records audit trail', async () => {
      const session = getCoordinatorSession();
      const availableDonations = repository.listAllDonationsForCoordinator('Available');
      const don = availableDonations.items[0];

      const res = await request(app)
        .post(`/api/coordinator/donations/${don.id}/resolve`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'openDispute',
          reason: 'Recipient reported temperature check failure upon arrival.',
          expectedVersion: don.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('Disputed');

      // Verify audit event
      const audits = repository.listAuditEvents(20).items;
      const disputeAudit = audits.find(
        (a) => a.eventType === 'donation_resolve' && a.entityId === don.id
      );
      expect(disputeAudit).toBeDefined();
      expect(disputeAudit?.toStatus).toBe('Disputed');
    });

    it('rejects resolution with stale version returning 409 Conflict', async () => {
      const session = getCoordinatorSession();
      const availableDonations = repository.listAllDonationsForCoordinator('Available');
      const don = availableDonations.items[0];

      const res = await request(app)
        .post(`/api/coordinator/donations/${don.id}/resolve`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          decision: 'openDispute',
          reason: 'Reporting dispute with outdated version record.',
          expectedVersion: 999,
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  // --------------------------------------------------------------------------
  // EP-034: GET /api/coordinator/analytics (T-API-EP034)
  // --------------------------------------------------------------------------
  describe('EP-034: GET /api/coordinator/analytics', () => {
    it('returns record-derived operational impact analytics', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/analytics')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
      expect(typeof res.body.data.metrics.totalPortionsRescued).toBe('number');
      expect(typeof res.body.data.metrics.rescueEfficiencyPercentage).toBe('number');
      expect(Array.isArray(res.body.data.byCategory)).toBe(true);
      expect(Array.isArray(res.body.data.byCity)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EP-035: GET /api/coordinator/audit (T-API-EP035)
  // --------------------------------------------------------------------------
  describe('EP-035: GET /api/coordinator/audit', () => {
    it('retrieves paginated immutable audit log with entity filter', async () => {
      const session = getCoordinatorSession();

      const res = await request(app)
        .get('/api/coordinator/audit?entity=Donation')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items.every((a: { entityType: string }) => a.entityType === 'Donation')).toBe(true);
    });
  });
});
