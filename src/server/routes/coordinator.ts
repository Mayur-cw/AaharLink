import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  coordinatorOrgsQuerySchema,
  coordinatorOrgDecisionSchema,
  coordinatorDonationsQuerySchema,
  coordinatorDonationResolveSchema,
  coordinatorAnalyticsQuerySchema,
  coordinatorAuditQuerySchema,
  createSuccessEnvelope,
  createErrorEnvelope,
  responseCode,
  type RedactedAuditEvent,
} from '../../shared/contracts.js';
import { repository } from '../repository.js';
import {
  requireRoles,
  requireCsrf,
  mutationRateLimiter,
  readRateLimiter,
  type Principal,
} from '../authz.js';
import {
  getCoordinatorDashboard,
  formatCoordinatorOrgDetail,
  formatCoordinatorDonationDetail,
  getDerivedAnalytics,
} from '../domain/analytics.js';

export const coordinatorRouter = Router();

// EP-027: GET /api/coordinator/dashboard
coordinatorRouter.get(
  '/dashboard',
  requireRoles('coordinator'),
  readRateLimiter,
  (_req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    try {
      const dashboard = getCoordinatorDashboard();
      res.status(200).json(createSuccessEnvelope(dashboard, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to retrieve coordinator dashboard.', correlationId)
      );
    }
  }
);

// EP-028: GET /api/coordinator/organizations
coordinatorRouter.get(
  '/organizations',
  requireRoles('coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const queryResult = coordinatorOrgsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(400).json(
        createErrorEnvelope(
          responseCode.INVALID_INPUT,
          queryResult.error.issues[0]?.message || 'Invalid organizations query.',
          correlationId
        )
      );
      return;
    }

    const { status, kind, q, cursor, limit } = queryResult.data;

    try {
      const result = repository.listOrganizationsForCoordinator(status, kind, q, limit, cursor);
      res.status(200).json(createSuccessEnvelope(result, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to list organizations.', correlationId)
      );
    }
  }
);

// EP-029: GET /api/coordinator/organizations/:id
coordinatorRouter.get(
  '/organizations/:id',
  requireRoles('coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid organization ID.', correlationId));
      return;
    }

    const org = repository.getOrgById(id);
    if (!org) {
      res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Organization not found.', correlationId));
      return;
    }

    try {
      const detail = formatCoordinatorOrgDetail(org);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to retrieve organization detail.', correlationId)
      );
    }
  }
);

// EP-030: POST /api/coordinator/organizations/:id/decision
coordinatorRouter.post(
  '/organizations/:id/decision',
  requireRoles('coordinator'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid organization ID.', correlationId));
      return;
    }

    const parseResult = coordinatorOrgDecisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Add a clear reason for this decision.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const { decision, reason, expectedVersion } = parseResult.data;

    try {
      const updatedOrg = repository.recordCoordinatorOrgDecision(
        id,
        decision,
        reason,
        expectedVersion,
        correlationId,
        principal.id
      );

      const detail = formatCoordinatorOrgDetail(updatedOrg);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, msg.replace('CONFLICT: ', ''), correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, msg.replace('NOT_FOUND: ', ''), correlationId));
        return;
      }
      if (msg.includes('INVALID_INPUT')) {
        res.status(422).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg.replace('INVALID_INPUT: ', ''), correlationId));
        return;
      }
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to record decision.', correlationId));
    }
  }
);

// EP-031: GET /api/coordinator/donations
coordinatorRouter.get(
  '/donations',
  requireRoles('coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const queryResult = coordinatorDonationsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(400).json(
        createErrorEnvelope(
          responseCode.INVALID_INPUT,
          queryResult.error.issues[0]?.message || 'Invalid donations query.',
          correlationId
        )
      );
      return;
    }

    const { status, urgent, q, cursor, sort, limit } = queryResult.data;

    try {
      const result = repository.listAllDonationsForCoordinator(status, urgent, q, sort, limit, cursor);
      res.status(200).json(createSuccessEnvelope(result, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to list donations.', correlationId)
      );
    }
  }
);

// EP-032: GET /api/coordinator/donations/:id
coordinatorRouter.get(
  '/donations/:id',
  requireRoles('coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid donation ID.', correlationId));
      return;
    }

    const donation = repository.getDonationById(id);
    if (!donation) {
      res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Donation not found.', correlationId));
      return;
    }

    try {
      const detail = formatCoordinatorDonationDetail(donation);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to retrieve donation detail.', correlationId)
      );
    }
  }
);

// EP-033: POST /api/coordinator/donations/:id/resolve
coordinatorRouter.post(
  '/donations/:id/resolve',
  requireRoles('coordinator'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid donation ID.', correlationId));
      return;
    }

    const parseResult = coordinatorDonationResolveSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Add a clear reason for this decision.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const { decision, reason, expectedVersion } = parseResult.data;

    try {
      const updatedDonation = repository.recordCoordinatorDonationResolve(
        id,
        decision,
        reason,
        expectedVersion,
        correlationId,
        principal.id
      );

      const detail = formatCoordinatorDonationDetail(updatedDonation);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, msg.replace('CONFLICT: ', ''), correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, msg.replace('NOT_FOUND: ', ''), correlationId));
        return;
      }
      if (msg.includes('INVALID_INPUT')) {
        res.status(422).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg.replace('INVALID_INPUT: ', ''), correlationId));
        return;
      }
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to resolve donation.', correlationId));
    }
  }
);

// EP-034: GET /api/coordinator/analytics
coordinatorRouter.get(
  '/analytics',
  requireRoles('coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const queryResult = coordinatorAnalyticsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(400).json(
        createErrorEnvelope(
          responseCode.INVALID_INPUT,
          queryResult.error.issues[0]?.message || 'Invalid analytics query.',
          correlationId
        )
      );
      return;
    }

    const startDate = queryResult.data.from || queryResult.data.startDate;
    const endDate = queryResult.data.to || queryResult.data.endDate;

    try {
      const analytics = getDerivedAnalytics(startDate, endDate);
      res.status(200).json(createSuccessEnvelope(analytics, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to compute analytics.', correlationId)
      );
    }
  }
);

// EP-035: GET /api/coordinator/audit
coordinatorRouter.get(
  '/audit',
  requireRoles('coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const queryResult = coordinatorAuditQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(400).json(
        createErrorEnvelope(
          responseCode.INVALID_INPUT,
          queryResult.error.issues[0]?.message || 'Invalid audit query.',
          correlationId
        )
      );
      return;
    }

    const { entity, event, from, to, cursor, limit } = queryResult.data;

    try {
      const result = repository.listAuditEvents(limit, cursor, entity, undefined, event, from, to);
      const items: RedactedAuditEvent[] = result.items.map((a) => ({
        id: a.id,
        correlationId: a.correlationId,
        actorRole: a.actorRole,
        entityType: a.entityType,
        entityId: a.entityId,
        eventType: a.eventType,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        reason: a.reason,
        occurredAtUtc: a.occurredAtUtc,
      }));

      res.status(200).json(createSuccessEnvelope({ items, nextCursor: result.nextCursor }, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to list audit log.', correlationId)
      );
    }
  }
);
