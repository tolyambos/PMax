import { prisma } from "./db";

/**
 * Checks the database connection and logs the status
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Try a simple query to check connection
    await prisma.$queryRaw`SELECT 1 as connection_test`;
    console.log("✅ PostgreSQL database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}
