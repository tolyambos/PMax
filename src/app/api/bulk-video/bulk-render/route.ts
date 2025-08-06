import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BulkVideoGenerator } from "@/app/utils/bulk-video/bulk-generator";
import { MultiFormatRenderer } from "@/app/utils/bulk-video/multi-format-renderer";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { projectId, videoIds, mode = "all" } = await request.json();

    if (!projectId || !videoIds || !Array.isArray(videoIds)) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Get project and verify ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bulkVideos: {
          where: {
            id: { in: videoIds },
            status: "completed"
          },
          include: {
            scenes: {
              where: { status: "completed" }
            }
          }
        }
      }
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const renderer = new MultiFormatRenderer();
    let renderCount = 0;

    // Process each video
    for (const video of project.bulkVideos) {
      // Skip videos with no scenes
      if (video.scenes.length === 0) {
        console.log(`Skipping video ${video.id} - no scenes`);
        continue;
      }

      // Check if all scenes are completed
      const allScenesCompleted = video.scenes.every(s => s.status === 'completed' && s.animationUrl);
      if (!allScenesCompleted) {
        console.log(`Skipping video ${video.id} - not all scenes completed`);
        continue;
      }

      renderCount++;
      
      console.log(`[BulkRender] Starting render for video ${video.id} in mode: ${mode}`);
      
      // Start rendering in background (don't await)
      renderer.renderBulkVideo(video.id, mode)
        .then(() => {
          console.log(`[BulkRender] Completed rendering video ${video.id}`);
        })
        .catch(error => {
          console.error(`[BulkRender] Failed to render video ${video.id}:`, error);
        });
    }

    // Return immediately without waiting
    return NextResponse.json({
      success: true,
      message: `Started rendering ${renderCount} videos`,
      totalVideos: renderCount
    });

  } catch (error) {
    console.error("Bulk render error:", error);
    return NextResponse.json(
      { error: "Failed to start bulk render" },
      { status: 500 }
    );
  }
}