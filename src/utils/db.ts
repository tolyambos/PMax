import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient is attached to the `global` object in development to prevent
 * exhausting your database connection limit.
 *
 * Learn more:
 * https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Monitor Prisma connection
 */
let isConnected = false;

prisma
  .$connect()
  .then(() => {
    isConnected = true;
    console.log("✅ PostgreSQL database connected successfully");
  })
  .catch((e) => {
    console.error("❌ Database connection failed:", e);
    isConnected = false;
  });

export { isConnected };
