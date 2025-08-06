import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { BulkVideoGenerator } from "@/app/utils/bulk-video/bulk-generator";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the video and verify ownership
    const video = await prisma.bulkVideo.findUnique({
      where: { id: videoId },
      include: {
        project: true,
        scenes: true,
        renderedVideos: true,
      },
    });

    if (!video || video.userId !== user.id) {
      return NextResponse.json({ error: "Video not found or unauthorized" }, { status: 404 });
    }

    // Reset video status to pending
    await prisma.bulkVideo.update({
      where: { id: videoId },
      data: {
        status: "pending",
        error: null,
      },
    });

    // Delete existing scenes and rendered videos
    await prisma.$transaction([
      prisma.bulkVideoScene.deleteMany({
        where: { bulkVideoId: videoId },
      }),
      prisma.renderedVideo.deleteMany({
        where: { bulkVideoId: videoId },
      }),
    ]);

    // Start regeneration process
    const generator = new BulkVideoGenerator({
      concurrency: 1,
      onProgress: async (progress) => {
        console.log(`[Regenerate] Video ${videoId} progress:`, progress);
      },
    });

    // Process single video
    generator.processSingleVideo(videoId)
      .then(async () => {
        // Check if video completed successfully
        const updatedVideo = await prisma.bulkVideo.findUnique({
          where: { id: videoId },
          select: { status: true, project: true },
        });
        
        if (updatedVideo?.status === "completed") {
          console.log(`[Regenerate] Video ${videoId} completed, triggering render...`);
          
          // Trigger render for this specific video
          try {
            const renderResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/bulk-video/bulk-render`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                projectId: updatedVideo.project.id,
                videoIds: [videoId] 
              }),
            });
            
            if (renderResponse.ok) {
              console.log(`[Regenerate] Render triggered for video ${videoId}`);
            } else {
              console.error(`[Regenerate] Failed to trigger render for video ${videoId}`);
            }
          } catch (error) {
            console.error(`[Regenerate] Error triggering render:`, error);
          }
        }
      })
      .catch((error) => {
        console.error(`[Regenerate] Failed to regenerate video ${videoId}:`, error);
        prisma.bulkVideo.update({
          where: { id: videoId },
          data: {
            status: "failed",
            error: error.message || "Regeneration failed",
          },
        });
      });

    return NextResponse.json({
      success: true,
      message: "Video regeneration started",
    });
  } catch (error) {
    console.error("Error regenerating video:", error);
    return NextResponse.json(
      { error: "Failed to start video regeneration" },
      { status: 500 }
    );
  }
}