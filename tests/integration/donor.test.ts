import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { AppDatabase, setTestDatabase, repository } from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';
import { sessionStore } from '../../src/server/session.js';
import { SESSION_COOKIE_NAME } from '../../src/server/authz.js';

describe('Donor Listing & Readiness Vertical APIs (T-06)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
    sessionStore.clearAll();
    await runDemoSeed();
    app = createApp();
  });

  describe('EP-010: GET /api/donor/dashboard', () => {
    it('returns donor dashboard metrics and active listings for verified donor', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.activeDonationsCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.urgentDonations).toBeDefined();
    });

    it('rejects non-donor role (NGO) with 403 Forbidden', async () => {
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    });

    it('rejects unauthenticated guest with 401', async () => {
      const res = await request(app).get('/api/donor/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('EP-011: GET /api/donor/donations', () => {
    it('returns paginated list of own donations for donor', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .get('/api/donor/donations')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('EP-012: POST /api/donor/donations (Publishing 40 Portions)', () => {
    it('publishes 40 surplus meals with required handling declarations', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);
      const now = new Date();

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          category: 'cooked',
          description: '40 hot meal packages with roti, sabzi and dal',
          offeredPortions: 40,
          preparedAt: new Date(now.getTime() - 1800000).toISOString(),
          pickupDeadline: new Date(now.getTime() + 14400000).toISOString(),
          pickupAddress: 'Annapurna Kitchen Main Counter, Station Road',
          pickupLatitude: 19.8700,
          pickupLongitude: 75.3200,
          handlingDeclarations: {
            safePreparation: true,
            properTemperature: true,
            cleanPackaging: true,
            accurateInformation: true,
            recipientAssessmentAcknowledgement: true,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.offeredPortions).toBe(40);
      expect(res.body.data.status).toBe('Available');
      expect(res.body.data.version).toBe(1);
    });

    it('rejects publication when handling declaration is missing', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);
      const now = new Date();

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          category: 'cooked',
          description: '40 hot meal packages',
          offeredPortions: 40,
          preparedAt: new Date(now.getTime() - 1800000).toISOString(),
          pickupDeadline: new Date(now.getTime() + 14400000).toISOString(),
          pickupAddress: 'Station Road',
          pickupLatitude: 19.8700,
          pickupLongitude: 75.3200,
          handlingDeclarations: {
            safePreparation: true,
            properTemperature: false, // Incomplete declaration
            cleanPackaging: true,
            accurateInformation: true,
            recipientAssessmentAcknowledgement: true,
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.ok).toBe(false);
    });

    it('rejects publication with past pickup deadline', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);
      const now = new Date();

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          category: 'cooked',
          description: '40 hot meal packages',
          offeredPortions: 40,
          preparedAt: new Date(now.getTime() - 3600000).toISOString(),
          pickupDeadline: new Date(now.getTime() - 1800000).toISOString(), // Past deadline
          pickupAddress: 'Station Road',
          pickupLatitude: 19.8700,
          pickupLongitude: 75.3200,
          handlingDeclarations: {
            safePreparation: true,
            properTemperature: true,
            cleanPackaging: true,
            accurateInformation: true,
            recipientAssessmentAcknowledgement: true,
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-013 & EP-014: Detail & Editing', () => {
    it('returns detail of own donation', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .get('/api/donor/donations/don-seed-available-18')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe('don-seed-available-18');
      expect(res.body.data.pickupAddress).toBeDefined();
    });

    it('updates available donation with expectedVersion CAS check', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .patch('/api/donor/donations/don-seed-available-18')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          description: 'Updated fresh hot rice and dal description',
          offeredPortions: 20,
          expectedVersion: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.offeredPortions).toBe(20);
      expect(res.body.data.version).toBe(2);
    });

    it('rejects patch with stale version (409)', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .patch('/api/donor/donations/don-seed-available-18')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          offeredPortions: 20,
          expectedVersion: 999, // Stale version
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-015: POST /api/donor/donations/:id/cancel', () => {
    it('cancels Available donation with clear reason and version', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .post('/api/donor/donations/don-seed-available-18/cancel')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          reason: 'Kitchen unexpectedly closing early for maintenance.',
          expectedVersion: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('Cancelled');
    });
  });

  describe('EP-016: POST /api/donor/donations/:id/ready (Pickup Readiness)', () => {
    it('confirms pickup readiness and returns one-time 6-digit code for Claimed donation', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      // NGO claims the 18-portion donation first
      repository.createClaim('don-seed-available-18', ngoUser.organizationId!, 1, 'corr-claim', ngoUser.id);

      // Donor confirms ready
      const res = await request(app)
        .post('/api/donor/donations/don-seed-available-18/ready')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          expectedVersion: 2, // Version is 2 after claim
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('Pickup Confirmed');
      expect(res.body.data.handoverCode).toMatch(/^[0-9]{6}$/);
    });

    it('rejects ready call on Available donation (status must be Claimed)', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .post('/api/donor/donations/don-seed-available-18/ready')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          expectedVersion: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });
});
