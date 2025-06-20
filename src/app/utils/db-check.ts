import { prisma } from "@/lib/prisma";

/**
 * Checks database connectivity and returns connection status
 * @returns Promise with connection status result
 */
export async function checkDatabaseConnection() {
  try {
    // Try to query the database with a simple query
    await prisma.$queryRaw`SELECT 1 as result`;
    console.log("✅ PostgreSQL database connected successfully");
    return {
      connected: true,
      message: "Connected to PostgreSQL database",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return {
      connected: false,
      message: `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get connection status for a specific user (checks if user record exists)
 */
export async function getUserConnectionStatus(userId: string) {
  try {
    if (!userId) {
      return {
        connected: false,
        message: "No user ID provided",
        timestamp: new Date().toISOString(),
      };
    }

    // Check if database is connected
    const dbStatus = await checkDatabaseConnection();
    if (!dbStatus.connected) {
      return dbStatus;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return {
        connected: true,
        userFound: false,
        message: `User with ID "${userId}" not found in database`,
        timestamp: new Date().toISOString(),
      };
    }

    // Get user's project count
    const projectCount = await prisma.project.count({
      where: { userId },
    });

    console.log(`✅ Found user ${userId} with ${projectCount} projects`);

    return {
      connected: true,
      userFound: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      projectCount,
      message: `User found with ${projectCount} projects`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Error checking user connection:", error);
    return {
      connected: false,
      userFound: false,
      message: `Error checking user: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
    };
  }
}
