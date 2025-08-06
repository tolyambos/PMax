import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { BulkVideoGenerator } from "@/app/utils/bulk-video/bulk-generator";

interface RouteParams {
  params: {
    videoId: string;
  };
}

// POST /api/bulk-video/video/[videoId]/regenerate-animation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = params.videoId;
    const { sceneId, animationProvider, animationPrompt } = await request.json();

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

    if (!scene.imageUrl) {
      return NextResponse.json(
        { error: "Scene has no image to animate" },
        { status: 400 }
      );
    }

    // Validate animation provider
    const validProvider = animationProvider && ['runway', 'bytedance'].includes(animationProvider)
      ? animationProvider as 'runway' | 'bytedance'
      : undefined;

    // Regenerate the animation
    const generator = new BulkVideoGenerator();
    
    // Start regeneration (async)
    generator.regenerateAnimation(sceneId, validProvider, animationPrompt).catch((error) => {
      console.error("Animation regeneration error:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Animation regeneration started",
      sceneId,
      provider: validProvider || "default",
    });
  } catch (error) {
    console.error("Error regenerating animation:", error);
    return NextResponse.json(
      { error: "Failed to regenerate animation" },
      { status: 500 }
    );
  }
}