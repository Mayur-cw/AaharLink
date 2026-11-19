import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  donationCreateSchema,
  donationPatchSchema,
  donationCancelSchema,
  pickupReadySchema,
  cursorPaginationSchema,
  createSuccessEnvelope,
  createErrorEnvelope,
  responseCode,
  type PickupReadinessReceipt,
  type Paginated,
  type DonationOwnerSummary,
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
  formatDonationOwnerDetail,
  formatDonationOwnerSummary,
  getDonorDashboardData,
} from '../domain/donations.js';

export const donorRouter = Router();

// EP-010: GET /api/donor/dashboard
donorRouter.get(
  '/dashboard',
  requireRoles('donor'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Donor organization required.', correlationId)
      );
      return;
    }

    const org = repository.getOrgById(principal.organizationId);
    if (!org || org.status !== 'verified') {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Organization verification is required.', correlationId)
      );
      return;
    }

    const dashboard = getDonorDashboardData(principal.organizationId);
    res.status(200).json(createSuccessEnvelope(dashboard, correlationId));
  }
);

// EP-011: GET /api/donor/donations
donorRouter.get(
  '/donations',
  requireRoles('donor'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Donor organization required.', correlationId)
      );
      return;
    }

    const queryResult = cursorPaginationSchema.safeParse(req.query);
    const limit = queryResult.success ? queryResult.data.limit : 20;
    const cursor = queryResult.success ? queryResult.data.cursor : undefined;

    const { items, nextCursor } = repository.listDonationsForDonor(principal.organizationId, limit, cursor);
    const mapped = items.map((d) => formatDonationOwnerSummary(d));

    const paginated: Paginated<DonationOwnerSummary> = {
      items: mapped,
      nextCursor,
    };

    res.status(200).json(createSuccessEnvelope(paginated, correlationId));
  }
);

// EP-012: POST /api/donor/donations
donorRouter.post(
  '/donations',
  requireRoles('donor'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Donor organization required.', correlationId)
      );
      return;
    }

    const org = repository.getOrgById(principal.organizationId);
    if (!org || org.status !== 'verified') {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Organization verification is required.', correlationId)
      );
      return;
    }

    const parseResult = donationCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Invalid donation data.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const data = parseResult.data;
    const id = crypto.randomUUID();

    try {
      const created = repository.createDonation(
        {
          id,
          donorOrganizationId: principal.organizationId,
          category: data.category,
          description: data.description,
          offeredPortions: data.offeredPortions,
          preparedAt: data.preparedAt,
          pickupDeadline: data.pickupDeadline,
          pickupAddress: data.pickupAddress,
          pickupLatitude: data.pickupLatitude,
          pickupLongitude: data.pickupLongitude,
          handlingDeclaredAt: new Date().toISOString(),
          declarationSnapshot: data.handlingDeclarations,
          status: 'Available',
        },
        correlationId,
        principal.id
      );

      const detail = formatDonationOwnerDetail(created);
      res.status(201).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('INVALID_INPUT')) {
        res.status(422).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg.replace('INVALID_INPUT: ', ''), correlationId));
        return;
      }
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to create donation.', correlationId));
    }
  }
);

// EP-013: GET /api/donor/donations/:id
donorRouter.get(
  '/donations/:id',
  requireRoles('donor'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid donation ID.', correlationId));
      return;
    }

    const donation = repository.getDonationById(id);
    if (!donation || donation.donorOrganizationId !== principal.organizationId) {
      res.status(404).json(
        createErrorEnvelope(responseCode.NOT_FOUND, 'This donation is not available to your account.', correlationId)
      );
      return;
    }

    const detail = formatDonationOwnerDetail(donation);
    res.status(200).json(createSuccessEnvelope(detail, correlationId));
  }
);

// EP-014: PATCH /api/donor/donations/:id
donorRouter.patch(
  '/donations/:id',
  requireRoles('donor'),
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

    const donation = repository.getDonationById(id);
    if (!donation || donation.donorOrganizationId !== principal.organizationId) {
      res.status(404).json(
        createErrorEnvelope(responseCode.NOT_FOUND, 'This donation is not available to your account.', correlationId)
      );
      return;
    }

    if (donation.status !== 'Available') {
      res.status(400).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, 'Only Available donations can be edited.', correlationId)
      );
      return;
    }

    const parseResult = donationPatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Invalid patch fields.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const data = parseResult.data;

    try {
      const updates: Record<string, unknown> = {};
      if (data.description !== undefined) updates.description = data.description;
      if (data.offeredPortions !== undefined) updates.offeredPortions = data.offeredPortions;
      if (data.pickupDeadline !== undefined) updates.pickupDeadline = data.pickupDeadline;
      if (data.pickupAddress !== undefined) updates.pickupAddress = data.pickupAddress;

      const updated = repository.updateDonation(id, updates, data.expectedVersion);
      const detail = formatDonationOwnerDetail(updated);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(
          createErrorEnvelope(responseCode.CONFLICT, 'Donation changed; reload its current state.', correlationId)
        );
        return;
      }
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to update donation.', correlationId)
      );
    }
  }
);

// EP-015: POST /api/donor/donations/:id/cancel
donorRouter.post(
  '/donations/:id/cancel',
  requireRoles('donor'),
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

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Donor organization required.', correlationId)
      );
      return;
    }

    const parseResult = donationCancelSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Cancel reason is required.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const { reason, expectedVersion } = parseResult.data;

    try {
      const cancelled = repository.cancelDonation(
        id,
        principal.organizationId,
        reason,
        expectedVersion,
        correlationId,
        principal.id
      );

      const detail = formatDonationOwnerDetail(cancelled);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('FORBIDDEN')) {
        res.status(403).json(createErrorEnvelope(responseCode.FORBIDDEN, 'This donation is not available to your account.', correlationId));
        return;
      }
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, 'Donation changed; reload its current state.', correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Donation not found.', correlationId));
        return;
      }
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg, correlationId));
    }
  }
);

// EP-016: POST /api/donor/donations/:id/ready
donorRouter.post(
  '/donations/:id/ready',
  requireRoles('donor'),
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

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'Donor organization required.', correlationId)
      );
      return;
    }

    const parseResult = pickupReadySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid expected version.', correlationId)
      );
      return;
    }

    const { expectedVersion } = parseResult.data;

    try {
      const result = repository.setDonationPickupReady(
        id,
        principal.organizationId,
        expectedVersion,
        correlationId,
        principal.id
      );

      const receipt: PickupReadinessReceipt = {
        donationId: result.donation.id,
        status: result.donation.status,
        handoverCode: result.handoverCode, // One-time 6-digit code shown ONLY in this authorized response
        expiresAt: result.donation.pickupDeadline,
        version: result.donation.version,
      };

      res.status(200).json(createSuccessEnvelope(receipt, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('FORBIDDEN')) {
        res.status(403).json(createErrorEnvelope(responseCode.FORBIDDEN, 'This donation is not available to your account.', correlationId));
        return;
      }
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, 'Donation changed; reload its current state.', correlationId));
        return;
      }
      if (msg.includes('GONE')) {
        res.status(410).json(createErrorEnvelope(responseCode.GONE, 'Pickup deadline has elapsed.', correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Donation not found.', correlationId));
        return;
      }
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg, correlationId));
    }
  }
);
