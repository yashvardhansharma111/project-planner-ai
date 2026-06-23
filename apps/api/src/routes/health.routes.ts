import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const DB_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** Liveness + DB readiness probe. */
router.get('/', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db: DB_STATES[dbState] ?? 'unknown',
  });
});

export default router;
