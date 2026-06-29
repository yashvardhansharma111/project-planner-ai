import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

/** Point Node's resolver at public DNS before SRV lookups (Atlas `mongodb+srv`). */
function applyDnsOverride(): void {
  const servers = env.DNS_SERVERS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length > 0) dns.setServers(servers);
}

/**
 * Serverless-safe Mongoose connection. Each warm function instance reuses one
 * connection across invocations (cached on the global object) instead of
 * opening a new one per request — which would exhaust the DB's connection pool.
 */
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { _mongoose?: Cache };
const cache: Cache = globalForMongoose._mongoose ?? { conn: null, promise: null };
globalForMongoose._mongoose = cache;

let seeded = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — cannot connect to MongoDB');
  }
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    applyDnsOverride();
    mongoose.set('strictQuery', true);
    // Clear the cached promise on failure so the next request can retry
    // (otherwise a single failed connect would poison all future requests).
    cache.promise = mongoose.connect(env.MONGODB_URI, { bufferCommands: false }).catch((err) => {
      cache.promise = null;
      throw err;
    });
  }
  cache.conn = await cache.promise;

  // Optionally seed demo data once per cold start (dev only).
  if (!seeded && env.NODE_ENV !== 'production' && env.SEED_DEMO === 'true') {
    seeded = true;
    try {
      const { seedDemoData } = await import('./services/seed.service');
      await seedDemoData();
    } catch (err) {
      console.error('⚠️  Demo seed failed:', err);
    }
  }

  return cache.conn;
}
