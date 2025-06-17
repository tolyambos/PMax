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
        backgroundHistory: true,
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const history = scene.backgroundHistory || [];

    // Generate fresh presigned URLs for all S3 images in history
    const historyWithFreshUrls = await Promise.all(
      (Array.isArray(history) ? history : []).map(async (item: any) => {
        let freshUrl = item.url;

        // Check if this is an S3 URL that needs a fresh presigned URL
        if (
          item.url &&
          (item.url.includes("wasabisys.com") ||
            item.url.includes("amazonaws.com") ||
            item.url.includes("s3."))
        ) {
          try {
            const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(
              item.url
            );
            freshUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
            console.log(
              `[background-history] Generated fresh URL for history item: ${bucketKey}`
            );
          } catch (error) {
            console.error(
              `[background-history] Failed to generate fresh URL for ${item.url}:`,
              error
            );
            // Keep original URL as fallback
          }
        }

        return {
          ...item,
          url: freshUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        history: historyWithFreshUrls,
      },
    });
  } catch (error) {
    console.error("[scenes/background-history] GET Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to load background history",
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
    const { url, prompt, timestamp, isOriginal } = body;

    if (!url || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: url and prompt" },
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
        backgroundHistory: true,
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Get current history
    const currentHistory = Array.isArray(scene.backgroundHistory)
      ? (scene.backgroundHistory as Array<{
          url: string;
          prompt: string;
          timestamp: number;
        }>)
      : [];

    // Add new entry to history (limit to last 20 entries)
    const newEntry = {
      url,
      prompt,
      timestamp: timestamp || Date.now(),
      isOriginal: isOriginal || false,
    };

    const updatedHistory = [...currentHistory, newEntry].slice(-20);

    // Update scene with new history
    await prisma.scene.update({
      where: {
        id: params.sceneId,
      },
      data: {
        backgroundHistory: updatedHistory,
      },
    });

    console.log(
      `[scenes/background-history] Added new entry for scene ${params.sceneId}`
    );

    return NextResponse.json({
      success: true,
      data: {
        history: updatedHistory,
      },
    });
  } catch (error) {
    console.error("[scenes/background-history] POST Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to save background history",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
