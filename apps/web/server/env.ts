// Server-only environment config (route handlers run in the Node.js runtime).
// Read from process.env directly — Next injects .env.local locally and the
// Vercel dashboard vars in production. No NEXT_PUBLIC_ prefix → never shipped
// to the browser.

export const env = {
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  // Comma-separated DNS servers for Node's resolver — needed on networks where
  // Node can't reach the system DNS for the SRV lookups `mongodb+srv://` does
  // (the "querySrv ECONNREFUSED" error). Defaults to public resolvers.
  DNS_SERVERS: process.env.DNS_SERVERS ?? '8.8.8.8,1.1.1.1',

  JWT_SECRET: process.env.JWT_SECRET ?? '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  GROQ_MAX_TOKENS: Number(process.env.GROQ_MAX_TOKENS ?? 4096),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  // Seed demo data on first DB connect (dev only). Off by default in prod.
  SEED_DEMO: (process.env.SEED_DEMO ?? 'false') as 'true' | 'false',
};
