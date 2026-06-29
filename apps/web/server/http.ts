import { Error as MongooseError } from 'mongoose';
import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type infer as ZInfer } from 'zod';

/** HTTP error carrying an explicit status code. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turn any thrown value into a proper JSON error response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  if (err instanceof MongooseError.CastError) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }
  if (err instanceof MongooseError.ValidationError) {
    return NextResponse.json({ error: 'Validation Error' }, { status: 400 });
  }
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    return NextResponse.json({ error: 'A record with that value already exists' }, { status: 409 });
  }
  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/**
 * Wrap a route handler so thrown ApiError / ZodError / Mongoose errors become
 * clean JSON responses — the equivalent of the Express error middleware.
 */
export function handler<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse the JSON body and validate it against a Zod schema (throws ZodError). */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<ZInfer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return schema.parse(body);
}
