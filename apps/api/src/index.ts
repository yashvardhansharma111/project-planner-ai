import http from "node:http";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/db";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  // 1. Connect to MongoDB if configured. When MONGODB_URI is empty the API
  //    runs on the in-memory store (data resets on restart) — handy for early
  //    endpoint testing before Atlas is wired up.
  if (env.MONGODB_URI) {
    await connectDatabase();
  } else {
    console.log(
      "⚠️  MONGODB_URI not set — using in-memory store (data resets on restart)",
    );
  }

  // 2. Build the Express app and wrap it in an HTTP server.
  //    (Socket.IO will attach to this same server in a later phase.)
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.API_PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.API_PORT}`);
    console.log(`   env: ${env.NODE_ENV}`);
  });

  // 3. Graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received — shutting down...`);
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error(" Failed to start API:", err);
  process.exit(1);
});
