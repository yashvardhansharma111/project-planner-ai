import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env';

/**
 * Standalone connectivity check — verifies MONGODB_URI without booting the API.
 * Run with:  npm run db:ping  (from apps/api)
 */
async function main(): Promise<void> {
  if (!env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in .env — nothing to ping.');
    process.exit(1);
  }

  const servers = env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (servers.length > 0) {
    dns.setServers(servers);
    console.log(`🔧 DNS resolver set to: ${servers.join(', ')}`);
  }

  const masked = env.MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  console.log(`→ Connecting to ${masked}`);

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const admin = mongoose.connection.db?.admin();
  const result = await admin?.ping();

  console.log('✅ Connected. Ping result:', result);
  console.log(`   database: ${mongoose.connection.name}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Could not connect to MongoDB:', err.message);
  process.exit(1);
});
