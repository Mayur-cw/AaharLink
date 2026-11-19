import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  cursorPaginationSchema,
  createSuccessEnvelope,
  createErrorEnvelope,
  responseCode,
  type OwnNotification,
  type Paginated,
} from '../../shared/contracts.js';
import { repository } from '../repository.js';
import {
  requireRoles,
  requireCsrf,
  mutationRateLimiter,
  readRateLimiter,
  type Principal,
} from '../authz.js';

export const notificationsRouter = Router();

// EP-008: GET /api/notifications
notificationsRouter.get(
  '/',
  requireRoles('donor', 'ngo', 'coordinator'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    const queryResult = cursorPaginationSchema.safeParse(req.query);
    const limit = queryResult.success ? queryResult.data.limit : 20;
    const cursor = queryResult.success ? queryResult.data.cursor : undefined;

    const { items, nextCursor } = repository.listNotificationsForUser(principal.id, limit, cursor);

    const mapped: OwnNotification[] = items.map((n) => ({
      id: n.id,
      userId: n.userId,
      kind: n.kind,
      message: n.message,
      objectType: n.objectType,
      objectId: n.objectId,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));

    const paginated: Paginated<OwnNotification> = {
      items: mapped,
      nextCursor,
    };

    res.status(200).json(createSuccessEnvelope(paginated, correlationId));
  }
);

// EP-009: PATCH /api/notifications/:id/read
notificationsRouter.patch(
  '/:id/read',
  requireRoles('donor', 'ngo', 'coordinator'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const id = req.params.id;

    if (!id || typeof id !== 'string') {
      res.status(400).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid notification ID.', correlationId)
      );
      return;
    }

    const updated = repository.markNotificationRead(id, principal.id);
    if (!updated) {
      res.status(404).json(
        createErrorEnvelope(responseCode.NOT_FOUND, 'Notification not found.', correlationId)
      );
      return;
    }

    const mapped: OwnNotification = {
      id: updated.id,
      userId: updated.userId,
      kind: updated.kind,
      message: updated.message,
      objectType: updated.objectType,
      objectId: updated.objectId,
      readAt: updated.readAt,
      createdAt: updated.createdAt,
    };

    res.status(200).json(createSuccessEnvelope(mapped, correlationId));
  }
);
