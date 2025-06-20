import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { s3Utils } from "@/lib/s3-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[background-history] GET request for scene: ${params.id}`);

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
        backgroundHistory: true,
        imageUrl: true,
      },
    });

    console.log(`[background-history] Scene found:`, {
      id: params.id,
      hasScene: !!scene,
      backgroundHistory: scene?.backgroundHistory,
      backgroundHistoryType: typeof scene?.backgroundHistory,
      imageUrl: scene?.imageUrl,
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Parse background history if it exists
    let history = [];
    if (scene.backgroundHistory) {
      try {
        history =
          typeof scene.backgroundHistory === "string"
            ? JSON.parse(scene.backgroundHistory)
            : scene.backgroundHistory;
        console.log(`[background-history] Parsed history:`, {
          originalType: typeof scene.backgroundHistory,
          parsedLength: Array.isArray(history) ? history.length : "not array",
          parsedHistory: history,
        });
      } catch (error) {
        console.error("Error parsing background history:", error);
        history = [];
      }
    } else {
      console.log(
        `[background-history] No background history found in database`
      );
    }

    // If no history but there's a background image, create initial history entry
    if (history.length === 0 && scene.imageUrl) {
      console.log(
        `[background-history] Creating initial history entry for imageUrl: ${scene.imageUrl}`
      );
      history = [
        {
          id: `initial-${Date.now()}`,
          url: scene.imageUrl,
          timestamp: new Date().toISOString(),
          prompt: "Original background",
          isOriginal: true,
        },
      ];
    }

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

    console.log(
      `[background-history] Returning ${historyWithFreshUrls.length} history items`
    );

    return NextResponse.json({
      success: true,
      data: {
        history: historyWithFreshUrls,
      },
    });
  } catch (error) {
    console.error("[scenes/background-history] GET Error:", error);
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
    console.log(`[background-history] POST request for scene: ${params.id}`);

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
    const { url, prompt, timestamp, isOriginal } = body;
    console.log(`[background-history] POST data:`, {
      url,
      prompt,
      timestamp,
      isOriginal,
    });

    if (!url || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: url and prompt" },
        { status: 400 }
      );
    }

    // Get current scene and its background history
    const scene = await prisma.scene.findFirst({
      where: {
        id: params.id,
        project: {
          userId: user.id,
        },
      },
      select: {
        backgroundHistory: true,
        imageUrl: true, // Also get current image URL to potentially add as original
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Parse existing history
    let currentHistory = [];
    if (scene.backgroundHistory) {
      try {
        currentHistory =
          typeof scene.backgroundHistory === "string"
            ? JSON.parse(scene.backgroundHistory)
            : scene.backgroundHistory;
      } catch (error) {
        console.error("Error parsing existing background history:", error);
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
      // Replace problematic characters if any exist
      cleanUrl = cleanUrl.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

      return cleanUrl;
    };

    const cleanUrl = cleanUrlForDatabase(url);
    console.log(`[background-history] Cleaned URL: ${url} -> ${cleanUrl}`);

    // Clean prompt to ensure JSON safety
    const cleanPrompt = prompt.replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();

    // Create new history entry
    const newEntry = {
      id: `bg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      url: cleanUrl,
      prompt: cleanPrompt,
      timestamp: timestamp || Date.now(), // Use numeric timestamp for consistency
      isOriginal: isOriginal || false,
    };

    // If this is the first edit (history is empty) and we have a current imageUrl,
    // add the original image to history first
    if (currentHistory.length === 0 && scene.imageUrl && !isOriginal) {
      console.log(
        `[background-history] Adding original image to history before first edit`
      );
      const originalEntry = {
        id: `original-${Date.now()}`,
        url: cleanUrlForDatabase(scene.imageUrl),
        prompt: "Original background",
        timestamp: Date.now() - 1000, // Set timestamp slightly earlier than the edit
        isOriginal: true,
      };
      currentHistory.push(originalEntry);
    }

    // Add to history (keep most recent entries, limit to 50)
    const updatedHistory = [...currentHistory, newEntry].slice(-50);

    // Log the data we're trying to save
    console.log(`[background-history] Attempting to save history:`, {
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
        `[background-history] JSON validation passed, updating scene...`
      );
      console.log(
        `[background-history] Letting Prisma handle JSON serialization...`
      );

      // Let Prisma handle JSON serialization automatically
      const updateResult = await prisma.scene.update({
        where: {
          id: params.id,
        },
        data: {
          backgroundHistory: updatedHistory, // Pass the object directly, not stringified
        },
      });

      console.log(
        `[background-history] Database update successful for scene ${params.id}`
      );
    } catch (dbError) {
      console.error(`[background-history] Database update failed:`, dbError);
      console.error(`[background-history] Error details:`, {
        name: (dbError as any)?.name,
        message: (dbError as any)?.message,
        code: (dbError as any)?.code,
        meta: (dbError as any)?.meta,
      });
      console.error(`[background-history] Problematic data:`, {
        sceneId: params.id,
        updatedHistory,
        jsonString: JSON.stringify(updatedHistory),
      });
      throw dbError;
    }

    console.log(
      `[background-history] Successfully saved history entry for scene ${params.id}`
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
    console.error("[scenes/background-history] POST Error:", error);
    console.error("[scenes/background-history] Full error object:", {
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
