import { ApiError } from './http';

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForLimiter = globalThis as unknown as { _rateBuckets?: Map<string, Bucket> };
const buckets = globalForLimiter._rateBuckets ?? new Map<string, Bucket>();
globalForLimiter._rateBuckets = buckets;

/**
 * In-memory fixed-window rate limiter (per client IP). MVP-grade — protects the
 * public AI endpoint from runaway cost. Throws ApiError(429) when exceeded.
 */
export function rateLimit(req: Request, { windowMs, max }: { windowMs: number; max: number }): void {
  const key =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
    if (bucket.count > max) {
      throw new ApiError(429, 'Too many requests — please slow down or sign in to continue.');
    }
  }

  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
  }
}
