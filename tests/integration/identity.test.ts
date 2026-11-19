import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { AppDatabase, setTestDatabase, repository } from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';
import { sessionStore } from '../../src/server/session.js';
import { SESSION_COOKIE_NAME } from '../../src/server/authz.js';

describe('Identity, Organization & Notification Vertical APIs (T-05)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
    sessionStore.clearAll();
    await runDemoSeed();
    app = createApp();
  });

  describe('EP-001: GET /api/auth/session', () => {
    it('returns unauthenticated session summary for guest', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.authenticated).toBe(false);
      expect(res.body.data.user).toBeNull();
    });

    it('returns authenticated summary with organization verification status', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.authenticated).toBe(true);
      expect(res.body.data.user.email).toBe('donor@aaharlink.example');
      expect(res.body.data.organization.verified).toBe(true);
      expect(res.headers['x-csrf-token']).toBe(session.csrfToken);
    });
  });

  describe('EP-002: POST /api/auth/login', () => {
    it('authenticates valid credentials, sets HttpOnly cookie and returns CSRF header', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'donor@aaharlink.example',
          password: 'DemoDonor!2026',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.authenticated).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain(SESSION_COOKIE_NAME);
      expect(res.headers['x-csrf-token']).toBeDefined();
    });

    it('rejects invalid password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'donor@aaharlink.example',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects nonexistent user with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@aaharlink.example',
          password: 'DemoDonor!2026',
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-003: POST /api/auth/register', () => {
    it('registers new donor as pending organization and returns receipt', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          organizationKind: 'donor',
          email: 'new-donor@fresh.example',
          password: 'SecurePassword123!',
          organizationName: 'Fresh Harvest Bakery',
          contactPerson: 'Sunita Rao',
          contactPhone: '+919876543210',
          city: 'Mumbai',
          latitude: 19.0760,
          longitude: 72.8777,
          consent: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.role).toBe('donor');
      expect(res.body.data.status).toBe('pending');

      // Verify user created in DB with pending org
      const user = repository.getUserByEmail('new-donor@fresh.example');
      expect(user).not.toBeNull();
      const org = repository.getOrgById(user!.organizationId!);
      expect(org?.status).toBe('pending');
    });

    it('rejects duplicate registration email with 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          organizationKind: 'donor',
          email: 'donor@aaharlink.example', // Already exists in seed
          password: 'SecurePassword123!',
          organizationName: 'Duplicate Kitchen',
          contactPerson: 'Sunita Rao',
          contactPhone: '+919876543210',
          city: 'Mumbai',
          latitude: 19.0760,
          longitude: 72.8777,
          consent: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects registration when user is already logged in (403)', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .send({
          organizationKind: 'ngo',
          email: 'another@example.com',
          password: 'SecurePassword123!',
          organizationName: 'Test Org',
          contactPerson: 'Person',
          contactPhone: '+919876543210',
          city: 'Mumbai',
          latitude: 19.0760,
          longitude: 72.8777,
          consent: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-004: POST /api/auth/logout', () => {
    it('revokes session, clears cookie, and returns 204 with CSRF token', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken);

      expect(res.status).toBe(204);
      expect(sessionStore.getSession(session.id)).toBeNull();
    });

    it('rejects logout from anonymous user with 401', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  describe('EP-005 & EP-006: Account Profile & Updates', () => {
    it('returns own profile for authenticated user', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .get('/api/account')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.organization.name).toBe('Annapurna Kitchen');
    });

    it('updates organization with optimistic version check and CSRF', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .patch('/api/account')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          organizationName: 'Annapurna Kitchen Deluxe',
          version: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.organization.name).toBe('Annapurna Kitchen Deluxe');
      expect(res.body.data.organization.version).toBe(2);
    });

    it('rejects account patch with stale version (409)', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .patch('/api/account')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          organizationName: 'Stale Update',
          version: 999, // Stale version
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-007: Password Change', () => {
    it('updates password when current password matches', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .post('/api/account/password')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          currentPassword: 'DemoDonor!2026',
          newPassword: 'BrandNewSecurePassword2026!',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.success).toBe(true);
    });

    it('rejects password change when current password is wrong', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      const res = await request(app)
        .post('/api/account/password')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewSecurePassword2026!',
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('EP-008 & EP-009: Private Notifications', () => {
    it('retrieves user own notifications and marks them as read', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const session = sessionStore.createSession(donorUser.id, donorUser.role, donorUser.organizationId);

      // Create a test notification
      repository.createNotification({
        userId: donorUser.id,
        kind: 'claim',
        message: 'Your donation has been claimed.',
        objectType: 'donation',
        objectId: 'don-test-1',
      });

      // EP-008: List notifications
      const listRes = await request(app)
        .get('/api/notifications')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(listRes.status).toBe(200);
      expect(listRes.body.ok).toBe(true);
      expect(listRes.body.data.items).toHaveLength(1);
      const notifId = listRes.body.data.items[0].id;
      expect(listRes.body.data.items[0].readAt).toBeNull();

      // EP-009: Mark read
      const readRes = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken);

      expect(readRes.status).toBe(200);
      expect(readRes.body.ok).toBe(true);
      expect(readRes.body.data.readAt).not.toBeNull();
    });

    it('prevents cross-tenant access to another user notification (404)', async () => {
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const ngoUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const ngoSession = sessionStore.createSession(ngoUser.id, ngoUser.role, ngoUser.organizationId);

      // Notification belonging to donor
      repository.createNotification({
        userId: donorUser.id,
        kind: 'claim',
        message: 'Private donor notification',
        objectType: 'donation',
        objectId: 'don-private',
      });

      const donorNotifs = repository.listNotificationsForUser(donorUser.id);
      const donorNotifId = donorNotifs.items[0].id;

      // NGO attempts to mark donor's notification as read
      const res = await request(app)
        .patch(`/api/notifications/${donorNotifId}/read`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${ngoSession.id}`])
        .set('x-csrf-token', ngoSession.csrfToken);

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });
  });
});
