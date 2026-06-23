import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

/**
 * Point Node's resolver at the configured DNS servers before connecting.
 * `mongodb+srv://` requires SRV/TXT lookups, and on some networks Node's
 * resolver can't reach the system DNS for those → "querySrv ECONNREFUSED".
 */
function applyDnsOverride(): void {
  const servers = env.DNS_SERVERS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length > 0) {
    dns.setServers(servers);
    console.log(`🔧 DNS resolver set to: ${servers.join(', ')}`);
  }
}

/**
 * Mongoose connection singleton.
 * Express + Socket.IO share one connection for the process lifetime.
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — cannot connect to MongoDB');
  }

  applyDnsOverride();
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  await mongoose.connect(env.MONGODB_URI);
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
