import { PrismaClient } from "@prisma/client";

const prismaGlobal = global as typeof global & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  prismaGlobal.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasourceUrl: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}

// Helper function to handle database operations with retry
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries === 0) throw error;
    
    // Retry on connection errors
    if (
      error.code === 'P1001' || // Can't reach database server
      error.code === 'P1002' || // Database server timeout
      error.message?.includes('connection') ||
      error.message?.includes('closed')
    ) {
      console.log(`Database operation failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

// Ensure mock user exists for development
export async function ensureMockUser(): Promise<boolean> {
  try {
    // Check if mock user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: "user-123" },
    });

    // If user exists, return true
    if (existingUser) {
      console.log("Mock user already exists.");
      return true;
    }

    // Create mock user if it doesn't exist
    await prisma.user.create({
      data: {
        id: "user-123",
        clerkId: "user-123",
        name: "Development User",
        email: "dev@example.com",
        role: "ADMIN",
        permissions: {
          create: {
            canCreateProjects: true,
            canUploadAssets: true,
            maxProjects: 1000,
            maxAssetStorage: BigInt(107374182400), // 100GB
          },
        },
      },
    });

    console.log("Created mock user successfully.");
    return true;
  } catch (error) {
    console.error("Error ensuring mock user exists:", error);
    return false;
  }
}