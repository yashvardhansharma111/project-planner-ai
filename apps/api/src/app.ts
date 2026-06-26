import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import adminRoutes from './routes/admin.routes';
import aiRoutes from './routes/ai.routes';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/documents.routes';
import healthRoutes from './routes/health.routes';
import projectRoutes from './routes/projects.routes';
import questionRoutes from './routes/questions.routes';

/**
 * Builds the Express application (no listener attached).
 * Routes mount here; index.ts wraps this in an HTTP server.
 */
export function createApp(): Express {
  const app = express();

  // Security headers (CSP, HSTS, X-Frame-Options, ...).
  app.use(helmet());

  // CORS — allow the configured frontend origin (cookies enabled for JWT
  // refresh). In development, also accept any localhost:<port> so it doesn't
  // matter which port Next.js picks (3000, 3001, …).
  const allowedOrigins = new Set([env.FRONTEND_URL]);
  app.use(
    cors({
      origin: (origin, cb) => {
        const ok =
          !origin || // same-origin / curl / server-to-server
          allowedOrigins.has(origin) ||
          (env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin));
        cb(ok ? null : new Error('Not allowed by CORS'), ok);
      },
      credentials: true,
    }),
  );

  // Body parsing.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Parse cookies (refresh token is delivered as an HTTP-only cookie).
  app.use(cookieParser());

  // Request logging (dev only).
  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Routes.
  app.use('/health', healthRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 + error handling — must be registered last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
