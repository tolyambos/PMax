import { prisma } from "@/lib/prisma";

/**
 * Get the current user ID for development
 */
export async function getCurrentUserId(): Promise<string | null> {
  // In development, we'll use a default user and create it if it doesn't exist
  if (process.env.NODE_ENV === "development") {
    const devUserId = "dev-user-id";

    try {
      // Ensure the dev user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: devUserId },
      });

      if (!existingUser) {
        // Create the dev user with permissions
        await prisma.user.create({
          data: {
            id: devUserId,
            clerkId: devUserId,
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
      }

      return devUserId;
    } catch (error) {
      console.error("Error ensuring dev user exists:", error);
      // Return the ID anyway, even if we couldn't create the user
      return devUserId;
    }
  }

  // For production, this would be replaced with actual auth
  return null;
}
