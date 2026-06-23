import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';

/** Lightweight HTTP error carrying an explicit status code. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 404 handler — reached when no route matched. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

/** Central error handler — must keep the 4-arg signature for Express. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Malformed ObjectId in the URL (e.g. GET /api/projects/not-a-real-id).
  if (err instanceof MongooseError.CastError) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  // Mongoose schema validation (e.g. value outside an enum on direct writes).
  if (err instanceof MongooseError.ValidationError) {
    res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
    return;
  }

  // Duplicate key (e.g. registering an email that already exists, race-safe).
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'A record with that value already exists' });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    ...(env.NODE_ENV === 'development' ? { message } : {}),
  });
}
