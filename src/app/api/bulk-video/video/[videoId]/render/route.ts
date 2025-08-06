import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { MultiFormatRenderer } from "@/app/utils/bulk-video/multi-format-renderer";

interface RouteParams {
  params: {
    videoId: string;
  };
}

// POST /api/bulk-video/video/[videoId]/render - Render all formats for a video
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = params.videoId;
    const { format } = await request.json(); // Optional specific format

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify video ownership and check if ready for rendering
    const video = await prisma.bulkVideo.findFirst({
      where: {
        id: videoId,
        userId: user.id,
      },
      include: {
        project: true,
        scenes: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found or access denied" },
        { status: 404 }
      );
    }

    // Check if all scenes are ready
    const allScenesReady = video.scenes.every(
      (scene) => scene.status === "completed" && scene.animationUrl
    );

    if (!allScenesReady) {
      return NextResponse.json(
        { error: "Not all scenes are ready for rendering" },
        { status: 400 }
      );
    }

    // Start rendering (async)
    const renderer = new MultiFormatRenderer();
    
    if (format) {
      // Render specific format
      renderer.renderSingleFormat(videoId, format).catch((error) => {
        console.error("Format rendering error:", error);
      });
    } else {
      // Render all formats
      renderer.renderBulkVideo(videoId).catch((error) => {
        console.error("Video rendering error:", error);
      });
    }

    return NextResponse.json({
      success: true,
      message: format ? `Rendering ${format} format` : "Rendering all formats",
      videoId,
    });
  } catch (error) {
    console.error("Error rendering video:", error);
    return NextResponse.json(
      { error: "Failed to render video" },
      { status: 500 }
    );
  }
}

// GET /api/bulk-video/video/[videoId]/render - Get rendered video URLs
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = params.videoId;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get rendered videos
    const renderedVideos = await prisma.renderedVideo.findMany({
      where: {
        bulkVideo: {
          id: videoId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        format: true,
        url: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ renderedVideos });
  } catch (error) {
    console.error("Error getting rendered videos:", error);
    return NextResponse.json(
      { error: "Failed to get rendered videos" },
      { status: 500 }
    );
  }
}