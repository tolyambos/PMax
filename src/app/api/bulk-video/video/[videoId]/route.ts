import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: {
    videoId: string;
  };
}

// GET /api/bulk-video/video/[videoId] - Get individual video details
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

    // Get video with all related data
    const video = await prisma.bulkVideo.findFirst({
      where: {
        id: videoId,
        userId: user.id,
      },
      include: {
        project: {
          select: {
            name: true,
            brandLogoUrl: true,
            logoPosition: true,
            logoWidth: true,
            logoHeight: true,
            defaultFormats: true,
            defaultDuration: true,
            defaultSceneCount: true,
            defaultAnimationProvider: true,
          },
        },
        scenes: {
          orderBy: { order: "asc" },
        },
        renderedVideos: true,
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ video });
  } catch (error) {
    console.error("Error getting bulk video:", error);
    return NextResponse.json(
      { error: "Failed to get video" },
      { status: 500 }
    );
  }
}

// PATCH /api/bulk-video/video/[videoId] - Update video (e.g., prompts)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = params.videoId;
    const body = await request.json();

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify video ownership
    const video = await prisma.bulkVideo.findFirst({
      where: {
        id: videoId,
        userId: user.id,
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found or access denied" },
        { status: 404 }
      );
    }

    // Update video fields
    const updatedVideo = await prisma.bulkVideo.update({
      where: { id: videoId },
      data: {
        textContent: body.textContent || video.textContent,
        productImageUrl: body.productImageUrl !== undefined ? body.productImageUrl : video.productImageUrl,
        customImageStyle: body.customImageStyle !== undefined ? body.customImageStyle : video.customImageStyle,
        customFormats: body.customFormats || video.customFormats,
        customAnimationProvider: body.customAnimationProvider || video.customAnimationProvider,
        customDuration: body.customDuration !== undefined ? body.customDuration : video.customDuration,
        customSceneCount: body.customSceneCount !== undefined ? body.customSceneCount : video.customSceneCount,
      },
    });

    return NextResponse.json({ video: updatedVideo });
  } catch (error) {
    console.error("Error updating bulk video:", error);
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}