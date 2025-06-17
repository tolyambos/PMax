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
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}

/**
 * Ensures that a mock user exists in the database.
 * This is useful for development purposes.
 * @returns A boolean indicating whether the mock user was created or already exists.
 */
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
        name: "Development User",
        email: "dev@example.com",
      },
    });

    console.log("Created mock user successfully.");
    return true;
  } catch (error) {
    console.error("Error ensuring mock user exists:", error);
    return false;
  }
}
