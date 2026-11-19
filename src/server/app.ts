import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { correlationMiddleware, sessionMiddleware } from './authz.js';
import { createErrorEnvelope, responseCode } from '../shared/contracts.js';
import { authRouter } from './routes/auth.js';
import { accountRouter } from './routes/account.js';
import { notificationsRouter } from './routes/notifications.js';
import { donorRouter } from './routes/donor.js';
import { ngoRouter } from './routes/ngo.js';
import { coordinatorRouter } from './routes/coordinator.js';
import { internalRouter } from './routes/internal.js';

export function createApp() {
  const config = getConfig();
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org', 'https://*.openstreetmap.org'],
          frameSrc: ["'self'", 'https://www.openstreetmap.org', 'https://*.openstreetmap.org'],
          connectSrc: ["'self'"],
        },
      },
    })
  );

  app.use(
    cors({
      origin: (origin, cb) =>
        cb(
          null,
          !origin ||
            config.ALLOWED_ORIGINS.split(',')
              .map((x) => x.trim())
              .includes(origin)
        ),
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 10000, // General IP safety; route-specific limiters apply
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => process.env.NODE_ENV !== 'production',
      handler: (_req, res) => {
        const correlationId = (res.locals.correlationId as string) || crypto.randomUUID();
        res.status(429).json(
          createErrorEnvelope(
            responseCode.RATE_LIMITED,
            'Too many requests; retry later.',
            correlationId
          )
        );
      },
    })
  );

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(correlationMiddleware());
  app.use(sessionMiddleware());

  // Health endpoint
  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Vertical API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/donor', donorRouter);
  app.use('/api/ngo', ngoRouter);
  app.use('/api/coordinator', coordinatorRouter);
  app.use('/api/internal', internalRouter);

  // Client static assets
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(dirname, '../../dist/client');
  app.use(express.static(staticDir, { maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));

  return app;
}
