import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureUserInDatabase } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";

export async function POST() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Sync current user with database
    const user = await ensureUserInDatabase(userId);

    // Get user stats with retry
    const [projectCount, assetCount] = await Promise.all([
      withRetry(() => prisma.project.count({ where: { userId: user.id } })),
      withRetry(() => prisma.asset.count({ where: { userId: user.id } })),
    ]);

    // Calculate storage used with retry
    const assets = await withRetry(() => 
      prisma.asset.findMany({
        where: { userId: user.id },
        select: { fileSize: true },
      })
    );

    const storageUsed = assets.reduce(
      (total, asset) => total + (asset.fileSize || 0),
      0
    );

    // Convert BigInt to string for JSON serialization
    const permission = user.permissions[0];
    const serializedPermission = permission
      ? {
          ...permission,
          maxAssetStorage: permission.maxAssetStorage.toString(),
        }
      : null;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: serializedPermission,
      },
      stats: {
        projectCount,
        assetCount,
        storageUsed,
        maxProjects: permission?.maxProjects || 10,
        maxStorage: Number(permission?.maxAssetStorage || 1073741824),
      },
    });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
