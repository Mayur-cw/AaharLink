import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Role, OrganizationStatus } from '../shared/contracts.js';
import { createErrorEnvelope, responseCode } from '../shared/contracts.js';
import { sessionStore } from './session.js';

export const SESSION_COOKIE_NAME = 'aaharlink_session';

export interface Principal {
  id: string;
  role: Role;
  organizationId: string | null;
  sessionToken: string;
  csrfToken: string;
}

export function correlationMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers['x-correlation-id'];
    const correlationId = typeof raw === 'string' && raw.trim().length > 0
      ? raw.trim()
      : crypto.randomUUID();
    res.locals.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  };
}

export function sessionMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);

    if (token) {
      const session = sessionStore.getSession(token);
      if (session) {
        res.locals.principal = {
          id: session.userId,
          role: session.role,
          organizationId: session.organizationId,
          sessionToken: session.id,
          csrfToken: session.csrfToken,
        } satisfies Principal;
        res.setHeader('X-CSRF-Token', session.csrfToken);
      }
    }

    next();
  };
}

export function requireRoles(...roles: Role[]): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal | undefined;

    if (!principal) {
      if (roles.includes('anonymous')) {
        next();
        return;
      }
      res.status(401).json(
        createErrorEnvelope(responseCode.UNAUTHORIZED, 'Sign in required.', correlationId)
      );
      return;
    }

    if (!roles.includes(principal.role)) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Not permitted.', correlationId)
      );
      return;
    }

    next();
  };
}

export function requireCsrf(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
    if (!mutatingMethods.includes(req.method)) {
      next();
      return;
    }

    // Explicit public auth paths do not require CSRF
    const publicPaths = ['/api/auth/login', '/api/auth/register'];
    if (publicPaths.includes(req.path)) {
      next();
      return;
    }

    const principal = res.locals.principal as Principal | undefined;
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();

    if (!principal) {
      // Unauthenticated mutating request handled by role guard
      next();
      return;
    }

    const clientCsrf = req.headers['x-csrf-token'];
    if (!clientCsrf || clientCsrf !== principal.csrfToken) {
      res.status(403).json(
        createErrorEnvelope(
          responseCode.FORBIDDEN,
          'Session verification failed; refresh and try again.',
          correlationId
        )
      );
      return;
    }

    next();
  };
}

// ============================================================================
// Specialized Rate Limiters (VR-041)
// ============================================================================

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === 'production' ? 30 : 5000, // Generous in dev/demo mode
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  handler: (_req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    res.status(429).json(
      createErrorEnvelope(
        responseCode.RATE_LIMITED,
        'Too many authentication attempts; please retry in a moment.',
        correlationId
      )
    );
  },
});

export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 60 : 10000, // 60 mutations per min in prod; skipped in dev
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  handler: (_req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    res.status(429).json(
      createErrorEnvelope(
        responseCode.RATE_LIMITED,
        'Too many update requests; please slow down and retry in a moment.',
        correlationId
      )
    );
  },
});

export const readRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 600 : 20000, // 600 reads per min in prod; skipped in dev
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  handler: (_req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    res.status(429).json(
      createErrorEnvelope(
        responseCode.RATE_LIMITED,
        'Too many read requests; please retry in a moment.',
        correlationId
      )
    );
  },
});

// ============================================================================
// Authorization Predicates & Scope Guards
// ============================================================================

export function isOwnOrganization(targetOrgId: string, principal: Principal): boolean {
  if (principal.role === 'coordinator') return true;
  return principal.organizationId === targetOrgId;
}

export function isVerifiedOrganization(status: OrganizationStatus): boolean {
  return status === 'verified';
}
