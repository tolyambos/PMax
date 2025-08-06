import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BulkVideoGenerator } from "@/app/utils/bulk-video/bulk-generator";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { projectId, videoIds } = await request.json();

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
            id: { in: videoIds }
          },
          include: {
            scenes: true
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

    // Reset videos to pending and clear scenes
    for (const video of project.bulkVideos) {
      // Delete existing scenes
      await prisma.bulkVideoScene.deleteMany({
        where: { bulkVideoId: video.id }
      });

      // Delete existing rendered videos
      await prisma.renderedVideo.deleteMany({
        where: { bulkVideoId: video.id }
      });

      // Reset video status
      await prisma.bulkVideo.update({
        where: { id: video.id },
        data: {
          status: "pending",
          error: null
        }
      });
    }

    // Start regeneration process
    const generator = new BulkVideoGenerator({
      concurrency: 3,
      onProgress: (progress) => {
        console.log("Bulk regeneration progress:", progress);
      }
    });
    
    // Process videos in background
    generator.generateBulkVideos(projectId).catch(error => {
      console.error("Bulk regeneration error:", error);
    });

    return NextResponse.json({
      success: true,
      message: `Started regenerating ${videoIds.length} videos`
    });

  } catch (error) {
    console.error("Bulk regenerate error:", error);
    return NextResponse.json(
      { error: "Failed to start bulk regeneration" },
      { status: 500 }
    );
  }
}