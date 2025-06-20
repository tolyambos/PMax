import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { s3Utils } from "@/lib/s3-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[animation-history] GET request for scene: ${params.id}`);

    // Check authentication using Clerk
    const authResult = auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database using Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const scene = await prisma.scene.findFirst({
      where: {
        id: params.id,
        project: {
          userId: user.id,
        },
      },
      select: {
        animationHistory: true,
        videoUrl: true,
        animationPrompt: true,
        animationStatus: true,
      },
    });

    console.log(`[animation-history] Scene found:`, scene);

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Parse animation history if it exists
    let history = [];
    if (scene.animationHistory) {
      try {
        history =
          typeof scene.animationHistory === "string"
            ? JSON.parse(scene.animationHistory)
            : scene.animationHistory;
      } catch (error) {
        console.error("Error parsing animation history:", error);
        history = [];
      }
    }

    // Current animation data
    const currentAnimation = scene.videoUrl
      ? {
          id: `current-${Date.now()}`,
          videoUrl: scene.videoUrl,
          animationPrompt: scene.animationPrompt,
          animationStatus: scene.animationStatus,
          timestamp: new Date().toISOString(),
          isCurrent: true,
        }
      : null;

    // If no history but there's a current animation, create initial history entry
    if (history.length === 0 && currentAnimation) {
      history = [currentAnimation];
    }

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

    return NextResponse.json({
      success: true,
      data: {
        history: historyWithFreshUrls,
        currentAnimation,
      },
    });
  } catch (error) {
    console.error("[scenes/animation-history] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[animation-history] POST request for scene: ${params.id}`);

    // Check authentication using Clerk
    const authResult = auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database using Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      videoUrl,
      animationPrompt,
      animationStatus,
      timestamp,
      sourceImageUrl,
      provider,
    } = body;
    console.log(`[animation-history] POST data:`, {
      videoUrl,
      animationPrompt,
      animationStatus,
      timestamp,
      sourceImageUrl,
      provider,
    });

    if (!videoUrl || !animationPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: videoUrl and animationPrompt" },
        { status: 400 }
      );
    }

    // Get current scene and its animation history
    const scene = await prisma.scene.findFirst({
      where: {
        id: params.id,
        project: {
          userId: user.id,
        },
      },
      select: {
        animationHistory: true,
        videoUrl: true, // Also get current video URL to potentially add as original
        animationPrompt: true,
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Parse existing history
    let currentHistory = [];
    if (scene.animationHistory) {
      try {
        currentHistory =
          typeof scene.animationHistory === "string"
            ? JSON.parse(scene.animationHistory)
            : scene.animationHistory;
      } catch (error) {
        console.error("Error parsing existing animation history:", error);
        currentHistory = [];
      }
    }

    // Clean URL - remove presigned query parameters and ensure JSON safety
    const cleanUrlForDatabase = (inputUrl: string): string => {
      let cleanUrl = inputUrl;

      // Remove presigned query parameters if present
      if (cleanUrl.includes("?X-Amz-")) {
        cleanUrl = cleanUrl.split("?")[0];
      }

      // Remove any other query parameters that might cause JSON issues
      if (cleanUrl.includes("?")) {
        cleanUrl = cleanUrl.split("?")[0];
      }

      // Ensure the URL doesn't contain characters that would break JSON
      cleanUrl = cleanUrl.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

      return cleanUrl;
    };

    const cleanVideoUrl = cleanUrlForDatabase(videoUrl);
    const cleanAnimationPrompt = animationPrompt
      .replace(/[\x00-\x1f\x7f-\x9f]/g, "")
      .trim();

    // Create new history entry
    const newEntry = {
      id: `anim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      videoUrl: cleanVideoUrl,
      animationPrompt: cleanAnimationPrompt,
      animationStatus: animationStatus || "completed",
      timestamp: timestamp || Date.now(), // Use numeric timestamp for consistency
      sourceImageUrl: sourceImageUrl
        ? cleanUrlForDatabase(sourceImageUrl)
        : undefined,
      provider: provider || undefined,
    };

    // If this is the first animation (history is empty) and we have a current videoUrl,
    // add the original animation to history first
    if (
      currentHistory.length === 0 &&
      scene.videoUrl &&
      scene.animationPrompt
    ) {
      console.log(
        `[animation-history] Adding original animation to history before new animation`
      );
      const originalEntry = {
        id: `original-anim-${Date.now()}`,
        videoUrl: cleanUrlForDatabase(scene.videoUrl),
        animationPrompt: scene.animationPrompt,
        animationStatus: "completed",
        timestamp: Date.now() - 1000, // Set timestamp slightly earlier than the new animation
        isOriginal: true,
      };
      currentHistory.push(originalEntry);
    }

    // Add to history (keep most recent entries, limit to 50)
    const updatedHistory = [...currentHistory, newEntry].slice(-50);

    // Log the data we're trying to save
    console.log(`[animation-history] Attempting to save history:`, {
      sceneId: params.id,
      newEntryId: newEntry.id,
      historyLength: updatedHistory.length,
      sampleEntry: updatedHistory[0],
      jsonStringLength: JSON.stringify(updatedHistory).length,
    });

    // Validate JSON structure before saving
    try {
      // Test that the data can be serialized and parsed
      const jsonString = JSON.stringify(updatedHistory);
      JSON.parse(jsonString);

      console.log(
        `[animation-history] JSON validation passed, updating scene...`
      );
      console.log(
        `[animation-history] Letting Prisma handle JSON serialization...`
      );

      // Let Prisma handle JSON serialization automatically
      const updateResult = await prisma.scene.update({
        where: {
          id: params.id,
        },
        data: {
          animationHistory: updatedHistory, // Pass the object directly, not stringified
        },
      });

      console.log(
        `[animation-history] Database update successful for scene ${params.id}`
      );
    } catch (dbError) {
      console.error(`[animation-history] Database update failed:`, dbError);
      console.error(`[animation-history] Error details:`, {
        name: (dbError as any)?.name,
        message: (dbError as any)?.message,
        code: (dbError as any)?.code,
        meta: (dbError as any)?.meta,
      });
      console.error(`[animation-history] Problematic data:`, {
        sceneId: params.id,
        updatedHistory,
        jsonString: JSON.stringify(updatedHistory),
      });
      throw dbError;
    }

    console.log(
      `[animation-history] Successfully saved history entry for scene ${params.id}`
    );

    return NextResponse.json({
      success: true,
      data: {
        sceneId: params.id,
        entry: newEntry,
        totalHistoryItems: updatedHistory.length,
      },
    });
  } catch (error) {
    console.error("[scenes/animation-history] POST Error:", error);
    console.error("[scenes/animation-history] Full error object:", {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code,
      meta: (error as any)?.meta,
      stack: (error as any)?.stack,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as any)?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
