import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  accountPatchSchema,
  passwordChangeSchema,
  createSuccessEnvelope,
  createErrorEnvelope,
  responseCode,
  type OwnAccountProfile,
  type SecurityChangeReceipt,
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
  mutationRateLimiter,
  readRateLimiter,
  type Principal,
} from '../authz.js';
import { getConfig } from '../config.js';

export const accountRouter = Router();

// EP-005: GET /api/account
accountRouter.get(
  '/',
  requireRoles('donor', 'ngo', 'coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    const user = repository.getUserById(principal.id);
    if (!user) {
      res.status(404).json(
        createErrorEnvelope(responseCode.NOT_FOUND, 'User not found.', correlationId)
      );
      return;
    }

    const org = user.organizationId ? repository.getOrgById(user.organizationId) : null;

    const profile: OwnAccountProfile = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            kind: org.kind,
            status: org.status,
            contactPerson: org.contactPerson,
            contactPhone: org.contactPhone,
            city: org.city,
            latitude: org.latitude,
            longitude: org.longitude,
            maxPortions: org.maxPortions,
            operatingRadiusKm: org.operatingRadiusKm,
            version: org.version,
            updatedAt: org.updatedAt,
          }
        : null,
    };

    res.status(200).json(createSuccessEnvelope(profile, correlationId));
  }
);

// EP-006: PATCH /api/account
accountRouter.patch(
  '/',
  requireRoles('donor', 'ngo', 'coordinator'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    const parseResult = accountPatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Invalid account update fields.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const data = parseResult.data;
    const user = repository.getUserById(principal.id);
    if (!user || !user.organizationId) {
      res.status(400).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, 'No organization associated with this account.', correlationId)
      );
      return;
    }

    try {
      const updates: Record<string, unknown> = {};
      if (data.organizationName !== undefined) updates.name = data.organizationName;
      if (data.contactPerson !== undefined) updates.contactPerson = data.contactPerson;
      if (data.contactPhone !== undefined) updates.contactPhone = data.contactPhone;
      if (data.city !== undefined) updates.city = data.city;
      if (data.latitude !== undefined) updates.latitude = data.latitude;
      if (data.longitude !== undefined) updates.longitude = data.longitude;

      const updatedOrg = repository.updateOrg(
        user.organizationId,
        updates,
        data.version
      );

      const profile: OwnAccountProfile = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        organization: {
          id: updatedOrg.id,
          name: updatedOrg.name,
          kind: updatedOrg.kind,
          status: updatedOrg.status,
          contactPerson: updatedOrg.contactPerson,
          contactPhone: updatedOrg.contactPhone,
          city: updatedOrg.city,
          latitude: updatedOrg.latitude,
          longitude: updatedOrg.longitude,
          maxPortions: updatedOrg.maxPortions,
          operatingRadiusKm: updatedOrg.operatingRadiusKm,
          version: updatedOrg.version,
          updatedAt: updatedOrg.updatedAt,
        },
      };

      res.status(200).json(createSuccessEnvelope(profile, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(
          createErrorEnvelope(responseCode.CONFLICT, 'Organization changed; reload and retry.', correlationId)
        );
        return;
      }
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to update organization.', correlationId)
      );
    }
  }
);

// EP-007: POST /api/account/password
accountRouter.post(
  '/password',
  requireRoles('donor', 'ngo', 'coordinator'),
  requireCsrf(),
  mutationRateLimiter,
  async (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    const parseResult = passwordChangeSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Invalid password fields.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const { currentPassword, newPassword } = parseResult.data;
    const user = repository.getUserById(principal.id);
    if (!user) {
      res.status(404).json(
        createErrorEnvelope(responseCode.NOT_FOUND, 'User not found.', correlationId)
      );
      return;
    }

    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(401).json(
        createErrorEnvelope(responseCode.UNAUTHORIZED, 'Current password is incorrect.', correlationId)
      );
      return;
    }

    const newHash = await hashPassword(newPassword);
    repository.updateUserPassword(user.id, newHash);

    // Revoke old sessions and issue new session for current client
    sessionStore.revokeAllUserSessions(user.id);
    const newSession = sessionStore.createSession(user.id, user.role, user.organizationId);
    const config = getConfig();

    res.cookie(SESSION_COOKIE_NAME, newSession.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      path: '/',
      maxAge: 12 * 3600 * 1000,
    });

    res.setHeader('X-CSRF-Token', newSession.csrfToken);

    repository.insertAuditEvent({
      correlationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      eventType: 'password_change',
      fromStatus: null,
      toStatus: null,
      reason: 'Password successfully changed',
      metadataRedacted: null,
    });

    const receipt: SecurityChangeReceipt = {
      success: true,
      message: 'Password updated successfully.',
    };

    res.status(200).json(createSuccessEnvelope(receipt, correlationId));
  }
);
