import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  loginBodySchema,
  registerBodySchema,
  createSuccessEnvelope,
  createErrorEnvelope,
  responseCode,
  type SessionSummary,
  type RegistrationReceipt,
} from '../../shared/contracts.js';
import { repository } from '../repository.js';
import {
  sessionStore,
  hashPassword,
  verifyPassword,
} from '../session.js';
import {
  SESSION_COOKIE_NAME,
  requireRoles,
  requireCsrf,
  authRateLimiter,
  type Principal,
} from '../authz.js';
import { getConfig } from '../config.js';

export const authRouter = Router();

// EP-001: GET /api/auth/session
authRouter.get('/session', requireRoles('anonymous', 'donor', 'ngo', 'coordinator'), (req: Request, res: Response) => {
  const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
  const principal = res.locals.principal as Principal | undefined;

  if (!principal) {
    const summary: SessionSummary = {
      authenticated: false,
      user: null,
      organization: null,
    };
    res.status(200).json(createSuccessEnvelope(summary, correlationId));
    return;
  }

  const user = repository.getUserById(principal.id);
  if (!user) {
    sessionStore.revokeSession(principal.sessionToken);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    const summary: SessionSummary = {
      authenticated: false,
      user: null,
      organization: null,
    };
    res.status(200).json(createSuccessEnvelope(summary, correlationId));
    return;
  }

  const org = user.organizationId ? repository.getOrgById(user.organizationId) : null;

  const summary: SessionSummary = {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization: org
      ? {
          id: org.id,
          name: org.name,
          kind: org.kind,
          status: org.status,
          city: org.city,
          verified: org.status === 'verified',
        }
      : null,
  };

  res.setHeader('X-CSRF-Token', principal.csrfToken);
  res.status(200).json(createSuccessEnvelope(summary, correlationId));
});

// EP-002: POST /api/auth/login
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();

  const parseResult = loginBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(422).json(
      createErrorEnvelope(
        responseCode.INVALID_INPUT,
        'Enter a valid email address and password.',
        correlationId
      )
    );
    return;
  }

  const { email, password } = parseResult.data;
  const user = repository.getUserByEmail(email);

  if (!user) {
    repository.insertAuditEvent({
      correlationId,
      actorUserId: 'anonymous',
      actorRole: 'anonymous',
      entityType: 'User',
      entityId: 'unknown',
      eventType: 'login_failed_redacted',
      fromStatus: null,
      toStatus: null,
      reason: 'User not found',
      metadataRedacted: null,
    });
    res.status(401).json(
      createErrorEnvelope(
        responseCode.UNAUTHORIZED,
        'Invalid email or password.',
        correlationId
      )
    );
    return;
  }

  const passwordMatch = await verifyPassword(password, user.passwordHash);
  if (!passwordMatch) {
    repository.insertAuditEvent({
      correlationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      eventType: 'login_failed_redacted',
      fromStatus: null,
      toStatus: null,
      reason: 'Incorrect password',
      metadataRedacted: null,
    });
    res.status(401).json(
      createErrorEnvelope(
        responseCode.UNAUTHORIZED,
        'Invalid email or password.',
        correlationId
      )
    );
    return;
  }

  // Rotate/create session
  const session = sessionStore.createSession(user.id, user.role, user.organizationId);
  const config = getConfig();

  res.cookie(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 3600 * 1000,
  });

  res.setHeader('X-CSRF-Token', session.csrfToken);

  repository.insertAuditEvent({
    correlationId,
    actorUserId: user.id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user.id,
    eventType: 'login',
    fromStatus: null,
    toStatus: null,
    reason: 'Successful authentication',
    metadataRedacted: null,
  });

  const org = user.organizationId ? repository.getOrgById(user.organizationId) : null;

  const summary: SessionSummary = {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization: org
      ? {
          id: org.id,
          name: org.name,
          kind: org.kind,
          status: org.status,
          city: org.city,
          verified: org.status === 'verified',
        }
      : null,
  };

  res.status(200).json(createSuccessEnvelope(summary, correlationId));
});

// EP-003: POST /api/auth/register
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
  const principal = res.locals.principal as Principal | undefined;

  // Authenticated users cannot self-register again
  if (principal) {
    res.status(403).json(
      createErrorEnvelope(
        responseCode.FORBIDDEN,
        'Already signed in; logout to register a new account.',
        correlationId
      )
    );
    return;
  }

  const parseResult = registerBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message || 'Registration data is invalid.';
    res.status(422).json(
      createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
    );
    return;
  }

  const data = parseResult.data;

  // Check existing user
  const existing = repository.getUserByEmail(data.email);
  if (existing) {
    res.status(409).json(
      createErrorEnvelope(
        responseCode.CONFLICT,
        'An account with that email already exists.',
        correlationId
      )
    );
    return;
  }

  const passwordHash = await hashPassword(data.password);
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();

  // Atomically create user and pending organization
  repository.withTransaction(() => {
    repository.createUser({
      id: userId,
      email: data.email,
      passwordHash,
      role: data.organizationKind,
      organizationId: orgId,
      sessionRevokedAt: null,
    });

    repository.createOrg({
      id: orgId,
      ownerUserId: userId,
      kind: data.organizationKind,
      name: data.organizationName,
      status: 'pending', // Starts as pending verification
      contactPhone: data.contactPhone,
      contactPerson: data.contactPerson,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      maxPortions: data.organizationKind === 'ngo' ? 100 : 0,
      operatingRadiusKm: data.organizationKind === 'ngo' ? 25.0 : 0,
    });

    repository.insertAuditEvent({
      correlationId,
      actorUserId: userId,
      actorRole: data.organizationKind,
      entityType: 'User',
      entityId: userId,
      eventType: 'register',
      fromStatus: null,
      toStatus: 'pending',
      reason: `New ${data.organizationKind} registration submitted`,
      metadataRedacted: { organizationName: data.organizationName, city: data.city },
    });
  });

  const receipt: RegistrationReceipt = {
    userId,
    organizationId: orgId,
    role: data.organizationKind,
    status: 'pending',
    message: 'Registration successful! Your application is pending coordinator verification.',
  };

  res.status(201).json(createSuccessEnvelope(receipt, correlationId));
});

// EP-004: POST /api/auth/logout
authRouter.post(
  '/logout',
  requireRoles('donor', 'ngo', 'coordinator'),
  requireCsrf(),
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    sessionStore.revokeSession(principal.sessionToken);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    repository.insertAuditEvent({
      correlationId,
      actorUserId: principal.id,
      actorRole: principal.role,
      entityType: 'User',
      entityId: principal.id,
      eventType: 'logout',
      fromStatus: null,
      toStatus: null,
      reason: 'User logged out',
      metadataRedacted: null,
    });

    res.status(204).end();
  }
);
