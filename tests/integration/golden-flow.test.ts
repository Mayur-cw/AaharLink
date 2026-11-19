import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { AppDatabase, setTestDatabase } from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';
import { sessionStore } from '../../src/server/session.js';

describe('T-QA-3: Golden Scenario End-to-End Multi-Role Workflow', () => {
  let app: ReturnType<typeof createApp>;
  let donorCookie: string;
  let donorCsrf: string;
  let ngoACookie: string;
  let ngoACsrf: string;
  let ngoBCookie: string;
  let ngoBCsrf: string;
  let coordinatorCookie: string;

  beforeEach(async () => {
    const testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
    sessionStore.clearAll();
    await runDemoSeed();

    app = createApp();

    // 1. Authenticate Donor (donor@aaharlink.example)
    const donorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'donor@aaharlink.example', password: 'DemoDonor!2026' });
    expect(donorRes.status).toBe(200);
    donorCookie = donorRes.headers['set-cookie'][0];
    donorCsrf = donorRes.headers['x-csrf-token'];

    // 2. Authenticate NGO A (ngo-a@aaharlink.example)
    const ngoARes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ngo-a@aaharlink.example', password: 'DemoNgoA!2026' });
    expect(ngoARes.status).toBe(200);
    ngoACookie = ngoARes.headers['set-cookie'][0];
    ngoACsrf = ngoARes.headers['x-csrf-token'];

    // 3. Authenticate NGO B (ngo-b@aaharlink.example)
    const ngoBRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ngo-b@aaharlink.example', password: 'DemoNgoB!2026' });
    expect(ngoBRes.status).toBe(200);
    ngoBCookie = ngoBRes.headers['set-cookie'][0];
    ngoBCsrf = ngoBRes.headers['x-csrf-token'];

    // 4. Authenticate Coordinator (coordinator@aaharlink.example)
    const coordRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'coordinator@aaharlink.example', password: 'DemoCoord!2026' });
    expect(coordRes.status).toBe(200);
    coordinatorCookie = coordRes.headers['set-cookie'][0];
  });

  it('executes full 8-step critical scenario from publishing to analytics reflection', async () => {
    // Step 1: Donor publishes 40 portions of cooked food with 4 food-handling affirmations and pickup deadline
    const futureDeadline = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    const preparedAt = new Date().toISOString();

    const publishRes = await request(app)
      .post('/api/donor/donations')
      .set('Cookie', donorCookie)
      .set('X-CSRF-Token', donorCsrf)
      .send({
        category: 'cooked',
        description: 'Golden Demo: 40 portions of hot vegetable biryani',
        offeredPortions: 40,
        preparedAt,
        pickupDeadline: futureDeadline,
        pickupAddress: 'Main Dispatch Bay, Sector 14, Delhi',
        pickupLatitude: 28.6139,
        pickupLongitude: 77.209,
        handlingDeclarations: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });

    expect(publishRes.status).toBe(201);
    expect(publishRes.body.ok).toBe(true);
    const donationId = publishRes.body.data.id;
    let donationVersion = publishRes.body.data.version;
    expect(donationId).toBeDefined();

    // Verify Available status and public discovery without contact disclosure
    const discoverRes = await request(app)
      .get('/api/ngo/discover')
      .set('Cookie', ngoACookie);
    expect(discoverRes.status).toBe(200);
    const found = discoverRes.body.data.items.find((d: { id: string }) => d.id === donationId);
    expect(found).toBeDefined();
    expect(found.offeredPortions).toBe(40);
    expect(found.pickupAddress).toBeUndefined(); // Address redacted
    expect(found.contactPhone).toBeUndefined(); // Phone redacted

    // Step 2: NGO A claims all 40 portions
    const claimARes = await request(app)
      .post(`/api/ngo/donations/${donationId}/claims`)
      .set('Cookie', ngoACookie)
      .set('X-CSRF-Token', ngoACsrf)
      .send({
        assessedDeclaration: true,
        expectedVersion: donationVersion,
      });

    expect(claimARes.status).toBe(201);
    expect(claimARes.body.ok).toBe(true);
    const claimId = claimARes.body.data.id;
    let claimVersion = claimARes.body.data.version;
    expect(claimId).toBeDefined();
    expect(claimARes.body.data.claimedPortions).toBe(40);
    // Unlocked contact details for winning claimer
    expect(claimARes.body.data.pickupAddress).toBe('Main Dispatch Bay, Sector 14, Delhi');

    // Step 3: NGO B attempts to claim the same donation -> 409 Conflict with zero contact leak
    const claimBRes = await request(app)
      .post(`/api/ngo/donations/${donationId}/claims`)
      .set('Cookie', ngoBCookie)
      .set('X-CSRF-Token', ngoBCsrf)
      .send({
        assessedDeclaration: true,
        expectedVersion: donationVersion,
      });

    expect(claimBRes.status).toBe(409);
    expect(claimBRes.body.ok).toBe(false);
    expect(claimBRes.body.error.code).toBe('CONFLICT');
    // Ensure zero contact details or private address leak in 409 response
    expect(JSON.stringify(claimBRes.body)).not.toContain('Main Dispatch Bay');
    expect(JSON.stringify(claimBRes.body)).not.toContain('+91');

    // Step 4: Donor confirms pickup ready and receives one-time 6-digit code
    // First, re-fetch donation to get updated version after claim
    const donorDetailRes = await request(app)
      .get(`/api/donor/donations/${donationId}`)
      .set('Cookie', donorCookie);
    expect(donorDetailRes.status).toBe(200);
    donationVersion = donorDetailRes.body.data.version;

    const readyRes = await request(app)
      .post(`/api/donor/donations/${donationId}/ready`)
      .set('Cookie', donorCookie)
      .set('X-CSRF-Token', donorCsrf)
      .send({
        expectedVersion: donationVersion,
      });

    expect(readyRes.status).toBe(200);
    expect(readyRes.body.ok).toBe(true);
    expect(readyRes.body.data.status).toBe('Pickup Confirmed');
    const handoverCode = readyRes.body.data.handoverCode;
    expect(handoverCode).toMatch(/^[0-9]{6}$/);

    // Step 5: NGO A driver verifies status is Ready
    const claimDetailRes = await request(app)
      .get(`/api/ngo/claims/${claimId}`)
      .set('Cookie', ngoACookie);
    expect(claimDetailRes.status).toBe(200);
    expect(claimDetailRes.body.data.status).toBe('Ready');
    claimVersion = claimDetailRes.body.data.version;

    // Step 6: NGO A driver enters code, confirms portions, signs recipient acceptance declaration
    const collectRes = await request(app)
      .post(`/api/ngo/claims/${claimId}/collect`)
      .set('Cookie', ngoACookie)
      .set('X-CSRF-Token', ngoACsrf)
      .send({
        handoverCode,
        actualPortions: 40,
        recipientAffirmation: true,
        expectedVersion: claimVersion,
      });

    expect(collectRes.status).toBe(200);
    expect(collectRes.body.ok).toBe(true);
    expect(collectRes.body.data.status).toBe('Completed');
    expect(collectRes.body.data.actualReceived).toBe(40);

    // Step 7: Verify atomic state transitions in DB
    const finalDonation = await request(app)
      .get(`/api/donor/donations/${donationId}`)
      .set('Cookie', donorCookie);
    expect(finalDonation.body.data.status).toBe('Completed');

    const finalClaim = await request(app)
      .get(`/api/ngo/claims/${claimId}`)
      .set('Cookie', ngoACookie);
    expect(finalClaim.body.data.status).toBe('Completed');

    // Step 8: Platform analytics compute directly from database rows
    const analyticsRes = await request(app)
      .get('/api/coordinator/analytics')
      .set('Cookie', coordinatorCookie);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.ok).toBe(true);
    const metrics = analyticsRes.body.data.metrics;
    expect(metrics.totalPortionsRescued).toBeGreaterThanOrEqual(40);
    expect(metrics.totalCompletedPickups).toBeGreaterThanOrEqual(1);

    // Step 9: Audit ledger verified
    const auditRes = await request(app)
      .get('/api/coordinator/audit?entity=Donation')
      .set('Cookie', coordinatorCookie);
    expect(auditRes.status).toBe(200);
    const donationAudit = auditRes.body.data.items.filter((a: { entityId: string }) => a.entityId === donationId);
    expect(donationAudit.length).toBeGreaterThanOrEqual(3); // created, claimed, completed
  });
});
