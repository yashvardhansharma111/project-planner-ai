import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load the repo-root .env (monorepo: api runs from apps/api, .env lives at root).
loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });
// Fallback: also load a local .env if one exists next to the api app.
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  // Optional for now — when empty, the API runs on the in-memory store.
  MONGODB_URI: z.string().optional(),
  // Comma-separated DNS servers for Node's resolver. Needed on networks where
  // Node can't reach the system DNS for the SRV lookups `mongodb+srv://` does
  // (the "querySrv ECONNREFUSED" error). Defaults to public resolvers.
  DNS_SERVERS: z.string().default('8.8.8.8,1.1.1.1'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Auth — separate secrets so an access token can never act as a refresh
  // token (and vice versa), even if one leaks.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '(root)';
    console.error(`  - ${field}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
