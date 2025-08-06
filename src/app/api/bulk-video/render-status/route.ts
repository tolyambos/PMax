import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get project with default formats
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
        projectType: "bulk-video",
      },
      select: {
        id: true,
        defaultFormats: true,
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get all completed bulk videos with their expected formats
    const bulkVideos = await prisma.bulkVideo.findMany({
      where: {
        projectId: projectId,
        status: 'completed'
      },
      select: {
        id: true,
        customFormats: true,
        renderedVideos: {
          select: {
            id: true,
            format: true,
            status: true
          }
        }
      }
    });
    
    // If no videos are completed yet, don't show render status
    if (bulkVideos.length === 0) {
      return NextResponse.json({
        projectId,
        isRendering: false,
        renderProgress: {
          totalRenders: 0,
          completedRenders: 0,
          failedRenders: 0,
          pendingRenders: 0,
          processingRenders: 0,
          currentRenders: [],
        },
      });
    }

    // Get render status counts
    const renderStats = await prisma.renderedVideo.groupBy({
      by: ['status'],
      where: {
        bulkVideo: {
          projectId: projectId
        }
      },
      _count: true,
    });

    // Get currently processing renders
    const processingRenders = await prisma.renderedVideo.findMany({
      where: {
        bulkVideo: {
          projectId: projectId
        },
        status: 'rendering'
      },
      select: {
        id: true,
        format: true,
        bulkVideoId: true,
        bulkVideo: {
          select: {
            rowIndex: true,
            textContent: true,
          }
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Show last 5 processing renders
    });

    // Calculate expected total renders based on videos and formats
    const projectFormats = project.defaultFormats || ['9x16'];
    let expectedTotal = 0;
    let actualCompleted = 0;
    let actualFailed = 0;
    let actualRendering = 0;
    
    bulkVideos.forEach(video => {
      const formats = video.customFormats.length > 0 ? video.customFormats : projectFormats;
      expectedTotal += formats.length;
      
      // Count actual completed/failed/rendering for this video
      video.renderedVideos.forEach(render => {
        if (render.status === 'completed') actualCompleted++;
        else if (render.status === 'failed') actualFailed++;
        else if (render.status === 'rendering') actualRendering++;
      });
    });

    // Use actual counts from the database
    const counts = {
      total: expectedTotal,
      pending: 0,
      rendering: 0,
      completed: 0,
      failed: 0,
    };

    renderStats.forEach((item) => {
      if (item.status === 'rendering') {
        counts.rendering = item._count;
      } else if (item.status === 'completed') {
        counts.completed = item._count;
      } else if (item.status === 'failed') {
        counts.failed = item._count;
      }
    });

    // Count actual render records in the database
    const totalActualRenders = counts.completed + counts.failed + counts.rendering;
    
    // Calculate pending based on expected vs actual
    counts.pending = Math.max(0, expectedTotal - totalActualRenders);

    // Get total count of render records for this project
    const totalRenderRecords = await prisma.renderedVideo.count({
      where: {
        bulkVideo: {
          projectId: projectId
        }
      }
    });
    
    // Determine if rendering is active:
    // Only show rendering when there are actual render records in the database
    const isRendering = counts.rendering > 0;

    return NextResponse.json({
      projectId,
      isRendering,
      renderProgress: {
        totalRenders: counts.total,
        completedRenders: counts.completed,
        failedRenders: counts.failed,
        pendingRenders: counts.pending,
        processingRenders: counts.rendering,
        currentRenders: processingRenders.map(r => ({
          id: r.id,
          format: r.format,
          videoIndex: r.bulkVideo.rowIndex,
          videoText: r.bulkVideo.textContent.substring(0, 50) + "...",
        })),
      },
    });
  } catch (error) {
    console.error("Error getting render status:", error);
    return NextResponse.json(
      { error: "Failed to get render status" },
      { status: 500 }
    );
  }
}