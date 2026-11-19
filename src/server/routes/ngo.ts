import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  claimCreateSchema,
  claimCancelSchema,
  claimCollectSchema,
  ngoCapacityPatchSchema,
  ngoDiscoverQuerySchema,
  ngoClaimsQuerySchema,
  createSuccessEnvelope,
  createErrorEnvelope,
  responseCode,
  type CollectionReceipt,
  type OwnClaimSummary,
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
  toDonationPublicPreview,
  toOwnClaimSummary,
  toOwnClaimDetail,
  getNgoDashboardData,
} from '../domain/claim.js';

export const ngoRouter = Router();

// EP-017: GET /api/ngo/dashboard
ngoRouter.get(
  '/dashboard',
  requireRoles('ngo'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
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

    try {
      const dashboard = getNgoDashboardData(principal.organizationId);
      res.status(200).json(createSuccessEnvelope(dashboard, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to retrieve NGO dashboard.', correlationId)
      );
    }
  }
);

// EP-018: GET /api/ngo/discover
ngoRouter.get(
  '/discover',
  requireRoles('ngo'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
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

    const queryResult = ngoDiscoverQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json(
        createErrorEnvelope(
          responseCode.INVALID_INPUT,
          queryResult.error.issues[0]?.message || 'Invalid discovery query.',
          correlationId
        )
      );
      return;
    }

    const {
      maxKm,
      category,
      limit,
      cursor,
      minPortions,
      before,
      sort,
      includeExpired,
    } = queryResult.data;

    try {
      const result = repository.listAvailableDonationsForNgo(
        org,
        maxKm,
        category,
        limit,
        cursor,
        minPortions,
        before,
        sort,
        includeExpired ?? false
      );
      res.status(200).json(createSuccessEnvelope(result, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to discover donations.', correlationId)
      );
    }
  }
);

// EP-019: GET /api/ngo/donations/:id
ngoRouter.get(
  '/donations/:id',
  requireRoles('ngo'),
  readRateLimiter,
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
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
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

    const donation = repository.getDonationById(id);
    if (!donation) {
      res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Donation not found.', correlationId));
      return;
    }

    const preview = toDonationPublicPreview(donation, org);
    res.status(200).json(createSuccessEnvelope(preview, correlationId));
  }
);

// EP-020: POST /api/ngo/donations/:id/claims
ngoRouter.post(
  '/donations/:id/claims',
  requireRoles('ngo'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const donationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!donationId) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid donation ID.', correlationId));
      return;
    }

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
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

    const parseResult = claimCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Review suitability before claiming.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const donation = repository.getDonationById(donationId);
    if (!donation) {
      res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Donation not found.', correlationId));
      return;
    }

    // Check cross-tenant rule: cannot claim own donation
    if (donation.donorOrganizationId === principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'You cannot claim your own donation.', correlationId)
      );
      return;
    }

    try {
      const claim = repository.createClaim(
        donationId,
        principal.organizationId,
        parseResult.data.expectedVersion,
        correlationId,
        principal.id
      );

      const donorOrg = repository.getOrgById(donation.donorOrganizationId);
      if (!donorOrg) {
        res.status(500).json(
          createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Donor organization record missing.', correlationId)
        );
        return;
      }

      const updatedDonation = repository.getDonationById(donationId) ?? donation;
      const detail = toOwnClaimDetail(claim, updatedDonation, donorOrg);
      res.status(201).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, msg.replace('CONFLICT: ', ''), correlationId));
        return;
      }
      if (msg.includes('GONE')) {
        res.status(410).json(createErrorEnvelope(responseCode.GONE, msg.replace('GONE: ', ''), correlationId));
        return;
      }
      if (msg.includes('INVALID_INPUT')) {
        res.status(422).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg.replace('INVALID_INPUT: ', ''), correlationId));
        return;
      }
      if (msg.includes('FORBIDDEN')) {
        res.status(403).json(createErrorEnvelope(responseCode.FORBIDDEN, msg.replace('FORBIDDEN: ', ''), correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, msg.replace('NOT_FOUND: ', ''), correlationId));
        return;
      }
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to claim donation.', correlationId));
    }
  }
);

// EP-021: GET /api/ngo/claims
ngoRouter.get(
  '/claims',
  requireRoles('ngo'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
      );
      return;
    }

    const queryResult = ngoClaimsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json(
        createErrorEnvelope(
          responseCode.INVALID_INPUT,
          queryResult.error.issues[0]?.message || 'Invalid claims query.',
          correlationId
        )
      );
      return;
    }

    const { status, sort, limit, cursor } = queryResult.data;

    try {
      const result = repository.listClaimsForNgo(
        principal.organizationId,
        limit,
        cursor,
        status,
        sort
      );

      const items: OwnClaimSummary[] = result.items.map((c) =>
        toOwnClaimSummary(c, c.donation, { name: c.donorOrgName, city: c.donorCity })
      );

      res.status(200).json(createSuccessEnvelope({ items, nextCursor: result.nextCursor }, correlationId));
    } catch {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to list claims.', correlationId)
      );
    }
  }
);

// EP-022: GET /api/ngo/claims/:id
ngoRouter.get(
  '/claims/:id',
  requireRoles('ngo'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const claimId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!claimId) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid claim ID.', correlationId));
      return;
    }

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
      );
      return;
    }

    const claim = repository.getClaimById(claimId);
    if (!claim || claim.ngoOrganizationId !== principal.organizationId) {
      // Disclose nothing to cross-tenant or missing
      res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Claim not found.', correlationId));
      return;
    }

    const donation = repository.getDonationById(claim.donationId);
    if (!donation) {
      res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, 'Donation not found.', correlationId));
      return;
    }

    const donorOrg = repository.getOrgById(donation.donorOrganizationId);
    if (!donorOrg) {
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Donor organization record missing.', correlationId)
      );
      return;
    }

    const detail = toOwnClaimDetail(claim, donation, donorOrg);
    res.status(200).json(createSuccessEnvelope(detail, correlationId));
  }
);

// EP-023: POST /api/ngo/claims/:id/cancel
ngoRouter.post(
  '/claims/:id/cancel',
  requireRoles('ngo'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const claimId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!claimId) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid claim ID.', correlationId));
      return;
    }

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
      );
      return;
    }

    const parseResult = claimCancelSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Add a clear reason for this decision.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    try {
      const cancelledClaim = repository.cancelClaim(
        claimId,
        principal.organizationId,
        parseResult.data.reason,
        parseResult.data.expectedVersion,
        correlationId,
        principal.id
      );

      const donation = repository.getDonationById(cancelledClaim.donationId);
      const donorOrg = donation ? repository.getOrgById(donation.donorOrganizationId) : null;

      if (!donation || !donorOrg) {
        res.status(500).json(
          createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Associated records missing.', correlationId)
        );
        return;
      }

      const detail = toOwnClaimDetail(cancelledClaim, donation, donorOrg);
      res.status(200).json(createSuccessEnvelope(detail, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, msg.replace('CONFLICT: ', ''), correlationId));
        return;
      }
      if (msg.includes('FORBIDDEN')) {
        res.status(403).json(createErrorEnvelope(responseCode.FORBIDDEN, msg.replace('FORBIDDEN: ', ''), correlationId));
        return;
      }
      if (msg.includes('INVALID_INPUT')) {
        res.status(422).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg.replace('INVALID_INPUT: ', ''), correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, msg.replace('NOT_FOUND: ', ''), correlationId));
        return;
      }
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to cancel claim.', correlationId));
    }
  }
);

// EP-024: POST /api/ngo/claims/:id/collect
ngoRouter.post(
  '/claims/:id/collect',
  requireRoles('ngo'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;
    const claimId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!claimId) {
      res.status(400).json(createErrorEnvelope(responseCode.INVALID_INPUT, 'Invalid claim ID.', correlationId));
      return;
    }

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
      );
      return;
    }

    const parseResult = claimCollectSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Invalid collection data.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const { handoverCode, actualPortions, expectedVersion } = parseResult.data;

    try {
      const result = repository.collectClaimAndCompleteDonation(
        claimId,
        principal.organizationId,
        handoverCode,
        actualPortions,
        expectedVersion,
        correlationId,
        principal.id
      );

      const receipt: CollectionReceipt = {
        claimId: result.claim.id,
        donationId: result.claim.donationId,
        status: result.claim.status,
        claimedPortions: result.claim.claimedPortions,
        actualReceived: result.claim.actualReceived ?? actualPortions,
        completedAt: result.claim.collectedAt ?? new Date().toISOString(),
        version: result.claim.version,
      };

      res.status(200).json(createSuccessEnvelope(receipt, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CONFLICT')) {
        res.status(409).json(createErrorEnvelope(responseCode.CONFLICT, msg.replace('CONFLICT: ', ''), correlationId));
        return;
      }
      if (msg.includes('GONE')) {
        res.status(410).json(createErrorEnvelope(responseCode.GONE, msg.replace('GONE: ', ''), correlationId));
        return;
      }
      if (msg.includes('FORBIDDEN')) {
        res.status(403).json(createErrorEnvelope(responseCode.FORBIDDEN, msg.replace('FORBIDDEN: ', ''), correlationId));
        return;
      }
      if (msg.includes('INVALID_INPUT')) {
        res.status(422).json(createErrorEnvelope(responseCode.INVALID_INPUT, msg.replace('INVALID_INPUT: ', ''), correlationId));
        return;
      }
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, msg.replace('NOT_FOUND: ', ''), correlationId));
        return;
      }
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to complete collection.', correlationId));
    }
  }
);

// EP-025: GET /api/ngo/capacity
ngoRouter.get(
  '/capacity',
  requireRoles('ngo'),
  readRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
      );
      return;
    }

    try {
      const capacity = repository.getNgoCapacity(principal.organizationId);
      res.status(200).json(createSuccessEnvelope(capacity, correlationId));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('NOT_FOUND')) {
        res.status(404).json(createErrorEnvelope(responseCode.NOT_FOUND, msg.replace('NOT_FOUND: ', ''), correlationId));
        return;
      }
      res.status(500).json(
        createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to get capacity.', correlationId)
      );
    }
  }
);

// EP-026: PATCH /api/ngo/capacity
ngoRouter.patch(
  '/capacity',
  requireRoles('ngo'),
  requireCsrf(),
  mutationRateLimiter,
  (req: Request, res: Response) => {
    const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
    const principal = res.locals.principal as Principal;

    if (!principal.organizationId) {
      res.status(403).json(
        createErrorEnvelope(responseCode.FORBIDDEN, 'NGO organization required.', correlationId)
      );
      return;
    }

    const parseResult = ngoCapacityPatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || 'Invalid capacity data.';
      res.status(422).json(
        createErrorEnvelope(responseCode.INVALID_INPUT, firstIssue, correlationId)
      );
      return;
    }

    const { maxPortions, operatingRadiusKm, latitude, longitude, version } = parseResult.data;

    try {
      const updates: Record<string, unknown> = {};
      if (maxPortions !== undefined) updates.maxPortions = maxPortions;
      if (operatingRadiusKm !== undefined) updates.operatingRadiusKm = operatingRadiusKm;
      if (latitude !== undefined) updates.latitude = latitude;
      if (longitude !== undefined) updates.longitude = longitude;

      repository.updateOrg(principal.organizationId, updates, version);
      const updatedCapacity = repository.getNgoCapacity(principal.organizationId);
      res.status(200).json(createSuccessEnvelope(updatedCapacity, correlationId));
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
      res.status(500).json(createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Failed to update capacity.', correlationId));
    }
  }
);
