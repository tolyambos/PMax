import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { BulkVideoGenerator } from "@/app/utils/bulk-video/bulk-generator";

interface RouteParams {
  params: {
    videoId: string;
  };
}

// POST /api/bulk-video/video/[videoId]/regenerate-scene
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = params.videoId;
    const { sceneId, newPrompt } = await request.json();

    if (!sceneId) {
      return NextResponse.json(
        { error: "Scene ID is required" },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify scene ownership through video
    const scene = await prisma.bulkVideoScene.findFirst({
      where: {
        id: sceneId,
        bulkVideo: {
          id: videoId,
          userId: user.id,
        },
      },
      include: {
        bulkVideo: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found or access denied" },
        { status: 404 }
      );
    }

    // Update prompt if provided
    if (newPrompt) {
      await prisma.bulkVideoScene.update({
        where: { id: sceneId },
        data: { prompt: newPrompt },
      });
    }

    // Regenerate the scene
    const generator = new BulkVideoGenerator();
    
    // Start regeneration (async)
    generator.regenerateScene(sceneId).catch((error) => {
      console.error("Scene regeneration error:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Scene regeneration started",
      sceneId,
    });
  } catch (error) {
    console.error("Error regenerating scene:", error);
    return NextResponse.json(
      { error: "Failed to regenerate scene" },
      { status: 500 }
    );
  }
}