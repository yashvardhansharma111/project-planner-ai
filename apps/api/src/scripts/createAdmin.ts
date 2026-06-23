import bcrypt from 'bcryptjs';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User';

const BCRYPT_ROUNDS = 12;

/**
 * Creates (or promotes) an admin user. Admins can't be created through the
 * public /register route — run this script instead.
 *
 *   npm run create:admin -- <email> <password> [full name]
 *
 * If a user with that email already exists, it is promoted to admin and its
 * password is reset to the one provided.
 */
async function main(): Promise<void> {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(' ') || 'Admin';

  if (!email || !password) {
    console.error('Usage: npm run create:admin -- <email> <password> [full name]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set — cannot create an admin.');
    process.exit(1);
  }

  // Same DNS workaround the API uses for Atlas SRV lookups.
  if (env.DNS_SERVERS) {
    dns.setServers(env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
  }

  await mongoose.connect(env.MONGODB_URI);
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    existing.isActive = true;
    await existing.save();
    console.log(`✅ Promoted existing user to admin: ${normalizedEmail}`);
  } else {
    await UserModel.create({
      fullName,
      email: normalizedEmail,
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`✅ Created admin user: ${normalizedEmail}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to create admin:', err.message);
  process.exit(1);
});
