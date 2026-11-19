import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  internalReconcileExpiredSchema,
  createErrorEnvelope,
  responseCode,
} from '../../shared/contracts.js';
import { runDeadlineReconciliation } from '../domain/expiry.js';
import type { Principal } from '../authz.js';

export const internalRouter = Router();

// EP-036: POST /api/internal/reconcile-expired
internalRouter.post('/reconcile-expired', (req: Request, res: Response) => {
  const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
  const principal = res.locals.principal as Principal | undefined;

  // Internal route: No public roles (donor, ngo, coordinator) allowed to call directly
  if (principal) {
    res.status(403).json(
      createErrorEnvelope(responseCode.FORBIDDEN, 'Internal system route; client execution forbidden.', correlationId)
    );
    return;
  }

  const parseResult = internalReconcileExpiredSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(401).json(
      createErrorEnvelope(responseCode.UNAUTHORIZED, 'Valid internalTaskNonce required.', correlationId)
    );
    return;
  }

  // Nonce validation: must be non-empty valid internal service token
  const nonce = parseResult.data.internalTaskNonce;
  if (!nonce || nonce.trim().length === 0) {
    res.status(401).json(
      createErrorEnvelope(responseCode.UNAUTHORIZED, 'Valid internalTaskNonce required.', correlationId)
    );
    return;
  }

  try {
    runDeadlineReconciliation();
    res.status(204).end();
  } catch {
    res.status(500).json(
      createErrorEnvelope(responseCode.INTERNAL_ERROR, 'Internal expiry reconciliation failed.', correlationId)
    );
  }
});
