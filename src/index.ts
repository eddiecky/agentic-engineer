import Fastify from "fastify";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { webhookRoutes } from "./api/webhooks.js";

async function main() {
  const app = Fastify({
    logger: false, // We use pino directly
  });

  // Register routes
  await app.register(webhookRoutes, { prefix: "/webhooks" });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down server");
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Start server
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT }, "Server started");
  } catch (error) {
    logger.error(error, "Failed to start server");
    process.exit(1);
  }
}

main();
