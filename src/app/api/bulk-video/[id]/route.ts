import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/bulk-video/[id] - Get bulk video project details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get project with all related data
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
        projectType: "bulk-video",
      },
      include: {
        bulkVideos: {
          include: {
            scenes: {
              orderBy: { order: "asc" },
            },
            renderedVideos: true,
            _count: {
              select: {
                scenes: true,
                renderedVideos: true,
              },
            },
          },
          orderBy: { rowIndex: "asc" },
        },
        _count: {
          select: {
            bulkVideos: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Calculate project statistics
    const stats = {
      totalVideos: project._count.bulkVideos,
      completedVideos: project.bulkVideos.filter(v => v.status === "completed").length,
      failedVideos: project.bulkVideos.filter(v => v.status === "failed").length,
      pendingVideos: project.bulkVideos.filter(v => v.status === "pending").length,
      processingVideos: project.bulkVideos.filter(v => v.status === "processing").length,
      totalRenderedFiles: project.bulkVideos.reduce((sum, v) => 
        sum + v.renderedVideos.filter(r => r.status === "completed").length, 0
      ),
    };

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        settings: {
          brandLogoUrl: project.brandLogoUrl,
          logoPosition: project.logoPosition,
          logoSize: {
            width: project.logoWidth,
            height: project.logoHeight,
          },
          defaultVideoStyle: project.defaultVideoStyle,
          defaultFormats: project.defaultFormats,
          defaultImageStyle: project.defaultImageStyle,
          defaultAnimationProvider: project.defaultAnimationProvider,
          defaultDuration: project.defaultDuration,
          defaultSceneCount: project.defaultSceneCount,
        },
        stats,
        videos: project.bulkVideos,
      },
    });
  } catch (error) {
    console.error("Error getting bulk video project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

// DELETE /api/bulk-video/[id] - Delete bulk video project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
        projectType: "bulk-video",
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Delete project (cascades to bulk videos, scenes, etc.)
    await prisma.project.delete({
      where: { id: projectId },
    });

    // TODO: Clean up S3 files

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bulk video project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}