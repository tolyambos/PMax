import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { User, Permission, Role } from "@prisma/client";

export type UserWithPermissions = User & {
  permissions: Permission[];
};

export async function getAuthenticatedUser(): Promise<UserWithPermissions | null> {
  const { userId } = auth();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { permissions: true },
  });

  return user;
}

export async function requireAuth(): Promise<UserWithPermissions> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function requireAdmin(): Promise<UserWithPermissions> {
  const user = await requireAuth();

  if (user.role !== Role.ADMIN) {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

export function checkPermission(
  user: UserWithPermissions,
  permission: keyof Permission
): boolean {
  if (user.role === Role.ADMIN) {
    return true;
  }

  const userPermission = user.permissions[0];
  if (!userPermission) {
    return false;
  }

  const value = userPermission[permission];
  return typeof value === "boolean" ? value : false;
}

export async function canCreateProject(user: UserWithPermissions): Promise<{ allowed: boolean; reason?: string; currentCount?: number; maxProjects?: number }> {
  // Check if user has permission to create projects
  const hasPermission = checkPermission(user, 'canCreateProjects');
  console.log("DEBUG - checkPermission result:", hasPermission);
  console.log("DEBUG - user.permissions[0]?.canCreateProjects:", user.permissions[0]?.canCreateProjects);
  
  if (!hasPermission) {
    return {
      allowed: false,
      reason: "You don't have permission to create projects. Please contact an administrator.",
    };
  }

  // Get user's permission settings
  const userPermission = user.permissions[0];
  if (!userPermission) {
    return {
      allowed: false,
      reason: "No permission settings found. Please contact an administrator.",
    };
  }

  // Count current projects
  const currentProjectCount = await prisma.project.count({
    where: { userId: user.id },
  });

  const maxProjects = userPermission.maxProjects;

  // Check if user has reached their project limit
  if (currentProjectCount >= maxProjects) {
    return {
      allowed: false,
      reason: `You have reached your project limit of ${maxProjects} projects. Please delete some projects or contact an administrator to increase your limit.`,
      currentCount: currentProjectCount,
      maxProjects: maxProjects,
    };
  }

  return {
    allowed: true,
    currentCount: currentProjectCount,
    maxProjects: maxProjects,
  };
}

export async function ensureUserInDatabase(clerkUserId: string) {
  const clerkUserData = await currentUser();

  if (!clerkUserData) {
    throw new Error("User not found in Clerk");
  }

  // Check if this is the first user
  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  // Use upsert to handle race conditions
  const user = await prisma.user.upsert({
    where: { clerkId: clerkUserId },
    create: {
      clerkId: clerkUserId,
      email: clerkUserData.emailAddresses[0]?.emailAddress,
      name:
        `${clerkUserData.firstName || ""} ${clerkUserData.lastName || ""}`.trim() ||
        null,
      image: clerkUserData.imageUrl,
      role: isFirstUser ? Role.ADMIN : Role.USER,
      permissions: {
        create: {
          canCreateProjects: isFirstUser, // Only admin (first user) can create projects by default
          canUploadAssets: true,
          maxProjects: isFirstUser ? 1000 : 0, // Admin gets 1000, regular users get 0 by default
          maxAssetStorage: isFirstUser ? 107374182400 : 1073741824, // 100GB for admin, 1GB for users
        },
      },
    },
    update: {
      email: clerkUserData.emailAddresses[0]?.emailAddress,
      name:
        `${clerkUserData.firstName || ""} ${clerkUserData.lastName || ""}`.trim() ||
        null,
      image: clerkUserData.imageUrl,
    },
    include: { permissions: true },
  });

  return user;
}
