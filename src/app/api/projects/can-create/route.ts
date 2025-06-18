import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canCreateProject } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();

    console.log("DEBUG - User permissions:", {
      userId: user.id,
      role: user.role,
      permissions: user.permissions[0]
    });

    // Check if user can create projects
    const canCreate = await canCreateProject(user);

    console.log("DEBUG - canCreateProject result:", canCreate);

    return NextResponse.json({
      success: true,
      canCreate: canCreate.allowed,
      reason: canCreate.reason,
      currentCount: canCreate.currentCount,
      maxProjects: canCreate.maxProjects,
      userRole: user.role,
      permissions: {
        canCreateProjects: user.permissions[0]?.canCreateProjects || false,
        canUploadAssets: user.permissions[0]?.canUploadAssets || false,
        maxProjects: user.permissions[0]?.maxProjects || 0,
        maxAssetStorage: user.permissions[0]?.maxAssetStorage || 0,
      },
    });
  } catch (error) {
    console.error("Error checking project creation permissions:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}