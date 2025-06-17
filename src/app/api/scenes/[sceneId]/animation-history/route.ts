import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/utils/auth-middleware";
import { prisma } from "@/app/utils/db";
import { s3Utils } from "@/lib/s3-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { sceneId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return authResult.error;
    }

    const userId = authResult.user.id;

    const scene = await prisma.scene.findFirst({
      where: {
        id: params.sceneId,
        project: {
          userId: userId,
        },
      },
      select: {
        animationHistory: true,
        videoUrl: true,
        animationPrompt: true,
        animationStatus: true,
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    console.log(`[animation-history] GET Scene ${params.sceneId} found:`, {
      hasHistory: !!scene.animationHistory,
      historyLength: Array.isArray(scene.animationHistory)
        ? scene.animationHistory.length
        : 0,
      videoUrl: scene.videoUrl ? scene.videoUrl.substring(0, 50) + "..." : null,
      animationPrompt: scene.animationPrompt,
      animationStatus: scene.animationStatus,
    });

    const history = scene.animationHistory || [];

    // Generate fresh presigned URLs for all S3 videos in history
    const historyWithFreshUrls = await Promise.all(
      (Array.isArray(history) ? history : []).map(async (item: any) => {
        let freshVideoUrl = item.videoUrl;

        // Check if this is an S3 URL that needs a fresh presigned URL
        if (
          item.videoUrl &&
          (item.videoUrl.includes("wasabisys.com") ||
            item.videoUrl.includes("amazonaws.com") ||
            item.videoUrl.includes("s3."))
        ) {
          try {
            const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(
              item.videoUrl
            );
            freshVideoUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
            console.log(
              `[animation-history] Generated fresh URL for history item: ${bucketKey}`
            );
          } catch (error) {
            console.error(
              `[animation-history] Failed to generate fresh URL for ${item.videoUrl}:`,
              error
            );
            // Keep original URL as fallback
          }
        }

        return {
          ...item,
          videoUrl: freshVideoUrl,
        };
      })
    );

    // Include current animation if it exists
    const currentAnimation = scene.videoUrl
      ? {
          videoUrl: scene.videoUrl,
          animationPrompt: scene.animationPrompt,
          animationStatus: scene.animationStatus,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        history: historyWithFreshUrls,
        currentAnimation,
      },
    });
  } catch (error) {
    console.error("[scenes/animation-history] GET Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to load animation history",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sceneId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return authResult.error;
    }

    const userId = authResult.user.id;

    const body = await request.json();
    console.log(`[animation-history] POST request body:`, {
      videoUrl: body.videoUrl
        ? `${body.videoUrl.substring(0, 50)}...`
        : "MISSING",
      animationPrompt: body.animationPrompt || "MISSING",
      animationStatus: body.animationStatus,
      timestamp: body.timestamp,
      sourceImageUrl: body.sourceImageUrl
        ? `${body.sourceImageUrl.substring(0, 50)}...`
        : "null",
    });

    const {
      videoUrl,
      animationPrompt,
      animationStatus,
      timestamp,
      sourceImageUrl,
    } = body;

    if (!videoUrl) {
      console.error(`[animation-history] Missing required field: videoUrl`);
      return NextResponse.json(
        { error: "Missing required field: videoUrl" },
        { status: 400 }
      );
    }

    // Use a fallback for animationPrompt if it's missing
    const finalAnimationPrompt = animationPrompt || "Generated animation";

    if (!finalAnimationPrompt.trim()) {
      console.error(`[animation-history] Empty animationPrompt provided`);
      return NextResponse.json(
        { error: "animationPrompt cannot be empty" },
        { status: 400 }
      );
    }

    // Verify scene ownership
    const scene = await prisma.scene.findFirst({
      where: {
        id: params.sceneId,
        project: {
          userId: userId,
        },
      },
      select: {
        animationHistory: true,
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Get current history
    const currentHistory = Array.isArray(scene.animationHistory)
      ? (scene.animationHistory as Array<{
          videoUrl: string;
          animationPrompt: string;
          animationStatus: string;
          timestamp: number;
        }>)
      : [];

    // Add new entry to history (limit to last 20 entries)
    const newEntry = {
      videoUrl,
      animationPrompt: finalAnimationPrompt,
      animationStatus: animationStatus || "completed",
      timestamp: timestamp || Date.now(),
      sourceImageUrl: sourceImageUrl || null, // Track which background image was animated
    };

    const updatedHistory = [...currentHistory, newEntry].slice(-20);

    // Update scene with new history
    await prisma.scene.update({
      where: {
        id: params.sceneId,
      },
      data: {
        animationHistory: updatedHistory,
      },
    });

    console.log(
      `[scenes/animation-history] Added new entry for scene ${params.sceneId}`
    );

    return NextResponse.json({
      success: true,
      data: {
        history: updatedHistory,
      },
    });
  } catch (error) {
    console.error("[scenes/animation-history] POST Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to save animation history",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
