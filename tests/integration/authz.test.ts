import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  sessionStore,
  hashPassword,
  verifyPassword,
  hashHandoverCode,
  verifyHandoverCode,
} from '../../src/server/session.js';
import {
  correlationMiddleware,
  sessionMiddleware,
  requireRoles,
  requireCsrf,
  SESSION_COOKIE_NAME,
} from '../../src/server/authz.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationMiddleware());
  app.use(sessionMiddleware());
  app.use(requireCsrf());

  // Test endpoints for different roles
  app.get('/api/guest-only', requireRoles('anonymous'), (_req, res) => {
    res.status(200).json({ ok: true, message: 'guest allowed' });
  });

  app.get('/api/donor-only', requireRoles('donor'), (_req, res) => {
    res.status(200).json({ ok: true, message: 'donor allowed' });
  });

  app.get('/api/ngo-only', requireRoles('ngo'), (_req, res) => {
    res.status(200).json({ ok: true, message: 'ngo allowed' });
  });

  app.get('/api/coordinator-only', requireRoles('coordinator'), (_req, res) => {
    res.status(200).json({ ok: true, message: 'coordinator allowed' });
  });

  app.post('/api/donor/create', requireRoles('donor'), (_req, res) => {
    res.status(201).json({ ok: true, message: 'created' });
  });

  return app;
}

describe('Role Authorization, Sessions & CSRF Integration (T-03)', () => {
  let app: express.Express;

  beforeEach(() => {
    sessionStore.clearAll();
    app = createTestApp();
  });

  describe('Deny-by-default Role Policy', () => {
    it('returns 401 when anonymous guest accesses protected endpoint', async () => {
      const res = await request(app).get('/api/donor-only');
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.correlationId).toBeDefined();
    });

    it('returns 403 when authenticated donor attempts to access NGO endpoint', async () => {
      const session = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');
      const res = await request(app)
        .get('/api/ngo-only')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 when authenticated NGO attempts to access coordinator endpoint', async () => {
      const session = sessionStore.createSession('user-ngo-1', 'ngo', 'org-ngo-1');
      const res = await request(app)
        .get('/api/coordinator-only')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 200 when role matches permitted scope', async () => {
      const session = sessionStore.createSession('user-coord-1', 'coordinator', null);
      const res = await request(app)
        .get('/api/coordinator-only')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('CSRF Token Enforcement on Mutations', () => {
    it('rejects mutating POST when CSRF header is missing', async () => {
      const session = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');
      const res = await request(app)
        .post('/api/donor/create')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .send({ item: 'food' });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.message).toContain('Session verification failed');
    });

    it('rejects mutating POST when CSRF token is mismatched', async () => {
      const session = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');
      const res = await request(app)
        .post('/api/donor/create')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', 'wrong-csrf-token')
        .send({ item: 'food' });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    });

    it('permits mutating POST when valid CSRF token is provided in header', async () => {
      const session = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');
      const res = await request(app)
        .post('/api/donor/create')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`])
        .set('x-csrf-token', session.csrfToken)
        .send({ item: 'food' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('Session Lifecycle & Revocation', () => {
    it('invalidates session upon revocation', async () => {
      const session = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');
      sessionStore.revokeSession(session.id);

      const res = await request(app)
        .get('/api/donor-only')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${session.id}`]);

      expect(res.status).toBe(401);
    });

    it('revokes all sessions for a user on password change', async () => {
      const s1 = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');
      const s2 = sessionStore.createSession('user-donor-1', 'donor', 'org-donor-1');

      sessionStore.revokeAllUserSessions('user-donor-1');

      expect(sessionStore.getSession(s1.id)).toBeNull();
      expect(sessionStore.getSession(s2.id)).toBeNull();
    });
  });

  describe('Password & Code Cryptographic Invariants', () => {
    it('correctly hashes and verifies passwords with bcrypt', async () => {
      const pass = 'SuperSecret1234!';
      const hash = await hashPassword(pass);
      expect(hash).not.toBe(pass);
      expect(await verifyPassword(pass, hash)).toBe(true);
      expect(await verifyPassword('WrongPassword!', hash)).toBe(false);
    });

    it('verifies 6-digit handover code with HMAC-SHA256 and timing-safe equality', () => {
      const code = '654321';
      const salt = 'random-salt-xyz';
      const hash = hashHandoverCode(code, salt);

      expect(verifyHandoverCode('654321', salt, hash)).toBe(true);
      expect(verifyHandoverCode('123456', salt, hash)).toBe(false);
      expect(verifyHandoverCode('000000', salt, hash)).toBe(false);
    });
  });
});
