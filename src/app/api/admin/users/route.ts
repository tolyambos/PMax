import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      include: {
        permissions: true,
        _count: {
          select: {
            projects: true,
            assets: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedUsers = users.map((user) => ({
      ...user,
      permissions: user.permissions.map((permission) => ({
        ...permission,
        maxAssetStorage: permission.maxAssetStorage.toString(),
      })),
    }));

    return NextResponse.json({ users: serializedUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch users",
      },
      {
        status:
          error instanceof Error &&
          error.message === "Forbidden: Admin access required"
            ? 403
            : 500,
      }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { userId, updates } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Handle role update
    if (updates.role) {
      await prisma.user.update({
        where: { id: userId },
        data: { role: updates.role as Role },
      });
    }

    // Handle permissions update
    if (updates.permissions) {
      const permission = await prisma.permission.findFirst({
        where: { userId },
      });

      if (permission) {
        await prisma.permission.update({
          where: { id: permission.id },
          data: updates.permissions,
        });
      } else {
        await prisma.permission.create({
          data: {
            userId,
            ...updates.permissions,
          },
        });
      }
    }

    // Fetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        _count: {
          select: {
            projects: true,
            assets: true,
          },
        },
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedUser = updatedUser
      ? {
          ...updatedUser,
          permissions: updatedUser.permissions.map((permission) => ({
            ...permission,
            maxAssetStorage: permission.maxAssetStorage.toString(),
          })),
        }
      : null;

    return NextResponse.json({ user: serializedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update user",
      },
      {
        status:
          error instanceof Error &&
          error.message === "Forbidden: Admin access required"
            ? 403
            : 500,
      }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action"); // 'delete' or 'ban'

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Don't allow admins to delete themselves
    const currentAdmin = await requireAdmin();
    if (currentAdmin.id === userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent deleting other admins
    if (user.role === Role.ADMIN) {
      return NextResponse.json(
        { error: "Cannot delete other admin users" },
        { status: 403 }
      );
    }

    if (action === "ban") {
      // Ban user by setting a banned flag (we'll need to add this to the schema)
      // For now, we'll just remove all permissions
      await prisma.permission.updateMany({
        where: { userId },
        data: {
          canCreateProjects: false,
          canUploadAssets: false,
          maxProjects: 0,
          maxAssetStorage: BigInt(0),
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: "User has been banned successfully" 
      });
    } else if (action === "delete") {
      // Delete user and all their data
      // Delete in correct order to respect foreign key constraints
      
      // Delete all scenes associated with user's projects
      const userProjects = await prisma.project.findMany({
        where: { userId },
        select: { id: true },
      });
      
      const projectIds = userProjects.map(p => p.id);
      
      // Delete scenes
      await prisma.scene.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // Delete projects
      await prisma.project.deleteMany({
        where: { userId },
      });

      // Delete assets
      await prisma.asset.deleteMany({
        where: { userId },
      });

      // Delete permissions
      await prisma.permission.deleteMany({
        where: { userId },
      });

      // Finally delete the user
      await prisma.user.delete({
        where: { id: userId },
      });

      return NextResponse.json({ 
        success: true, 
        message: "User and all associated data have been deleted" 
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'delete' or 'ban'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting/banning user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      {
        status:
          error instanceof Error &&
          error.message === "Forbidden: Admin access required"
            ? 403
            : 500,
      }
    );
  }
}