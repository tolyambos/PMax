import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { videoService } from "@/app/utils/video/video-service";
import { s3Utils } from "@/lib/s3-utils";
import { prisma } from "@/utils/db";

// Schema for video export requests
const ExportRequestSchema = z.object({
  projectId: z.string().min(1),
  scenes: z.array(
    z.object({
      id: z.string().optional(), // Add ID to help with scene matching
      order: z.number().optional(),
      imageUrl: z.string().min(1), // More flexible URL validation for S3 presigned URLs
      duration: z.number().min(0.1).max(60).default(3),
      backgroundColor: z.string().optional(),
      prompt: z.string().optional(),
      imagePrompt: z.string().optional(),
      animate: z.boolean().optional(),
      videoUrl: z.string().optional(), // Include the animated video URL if available
      animationStatus: z.string().optional(),
      animationPrompt: z.string().optional(),
      capturedWithElements: z.boolean().optional(), // Include capturedWithElements flag
      renderElementsServerSide: z.boolean().optional(), // Include renderElementsServerSide flag
      elements: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            content: z.string().optional(),
            x: z.number().default(0),
            y: z.number().default(0),
            width: z.number().optional(),
            height: z.number().optional(),
            rotation: z.number().default(0),
            opacity: z.number().default(1.0),
            zIndex: z.number().default(0),
            assetId: z.string().optional(),
            url: z.string().optional(),
          })
        )
        .optional(),
      projectId: z.string().optional(),
    })
  ),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  quality: z.enum(["high", "medium", "low"]).default("high"),
});

export async function POST(req: Request) {
  try {
    // Parse and validate request
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Log the request
    console.log("Video export request received");

    // Validate request
    try {
      body = ExportRequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return NextResponse.json(
          { error: "Validation error", details: errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    const { projectId, scenes: clientScenes, format, quality } = body;

    // NEW: Always fetch database scenes to ensure we have all elements and animations
    console.log(
      `Fetching complete scene data from database for project: ${projectId}`
    );

    // Define explicit type for database scenes
    interface DbScene {
      id: string;
      order: number;
      duration: number;
      projectId: string;
      imageUrl?: string | null;
      videoUrl?: string | null;
      prompt?: string | null;
      animationPrompt?: string | null;
      animationStatus?: string | null;
      elements: {
        id: string;
        type: string;
        content?: string | null;
        x: number;
        y: number;
        width?: number | null;
        height?: number | null;
        rotation: number;
        opacity: number;
        zIndex: number;
        sceneId: string;
        assetId?: string | null;
        url?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
      }[];
      createdAt?: Date;
      updatedAt?: Date;
    }

    let dbScenes: DbScene[] = [];
    try {
      dbScenes = await prisma.scene.findMany({
        where: {
          projectId: projectId,
        },
        orderBy: {
          order: "asc",
        },
        // Include elements for each scene
        include: {
          elements: true,
        },
      });

      console.log(
        `Retrieved ${dbScenes.length} scenes with elements from database`
      );
    } catch (dbError) {
      console.error("Error fetching scenes from database:", dbError);
      console.log("Will proceed without database elements");
    }

    // NEW: Merge client scenes with database data to ensure both elements and animations
    const mergedScenes = clientScenes.map((clientScene: any, index: number) => {
      // Try to find matching scene by ID if available, otherwise by index/order
      const dbSceneById = clientScene.id
        ? dbScenes.find((db) => db.id === clientScene.id)
        : null;
      const dbSceneByOrder = dbScenes[index]; // Fallback to matching by order

      // Use the best match (prefer ID match)
      const matchingDbScene = dbSceneById || dbSceneByOrder;

      if (!matchingDbScene) {
        console.log(
          `No matching DB scene found for client scene at index ${index}`
        );
        return clientScene; // No DB match, return client scene as is
      }

      // Log the match
      console.log(
        `Matched client scene ${index} with DB scene ID: ${matchingDbScene.id}`
      );

      // START MERGING LOGIC
      let mergedScene = { ...clientScene };

      // 1. Ensure we have the scene ID from DB
      mergedScene.id = matchingDbScene.id;

      // 2. Handle elements - use client elements if available, otherwise use DB elements
      if (!mergedScene.elements || mergedScene.elements.length === 0) {
        if (matchingDbScene.elements && matchingDbScene.elements.length > 0) {
          console.log(
            `Adding ${matchingDbScene.elements.length} elements from DB to scene index ${index}`
          );

          mergedScene.elements = matchingDbScene.elements.map((element) => ({
            id: element.id,
            type: element.type,
            content: element.content || undefined,
            x: Number(element.x),
            y: Number(element.y),
            width: element.width ? Number(element.width) : undefined,
            height: element.height ? Number(element.height) : undefined,
            rotation: Number(element.rotation),
            opacity: Number(element.opacity),
            zIndex: Number(element.zIndex),
            assetId: element.assetId || undefined,
            url: element.url || undefined,
          }));
        }
      }

      // 3. Handle videoUrl - use client videoUrl if available, otherwise use DB videoUrl
      if (!mergedScene.videoUrl && matchingDbScene.videoUrl) {
        console.log(
          `Adding videoUrl from DB for scene index ${index}: ${matchingDbScene.videoUrl}`
        );
        mergedScene.videoUrl = matchingDbScene.videoUrl;
      }

      // 4. Ensure duration is converted from DB milliseconds to seconds if needed
      if (clientScene.duration === undefined && matchingDbScene.duration) {
        // Convert from milliseconds to seconds if necessary
        const rawDuration = matchingDbScene.duration;
        // Check if the number is likely in milliseconds (over 100)
        const sceneDuration =
          rawDuration > 100 ? rawDuration / 1000 : rawDuration;
        mergedScene.duration = sceneDuration;
        console.log(
          `Using DB duration for scene ${index}: ${mergedScene.duration}s`
        );
      }

      // 5. Use DB prompt if client prompt is missing
      if (!mergedScene.imagePrompt && matchingDbScene.prompt) {
        mergedScene.imagePrompt = matchingDbScene.prompt;
        console.log(
          `Using DB prompt for scene ${index}: ${mergedScene.imagePrompt}`
        );
      }

      // 6. Use DB animation status if client animation status is missing
      if (!mergedScene.animationStatus && matchingDbScene.animationStatus) {
        mergedScene.animationStatus = matchingDbScene.animationStatus;
        console.log(
          `Using DB animationStatus for scene ${index}: ${mergedScene.animationStatus}`
        );
      }

      return mergedScene;
    });

    // Process scenes - fix animation and duration
    const processedScenes = mergedScenes.map((scene, index) => {
      // First make sure duration is a valid number
      const validDuration =
        typeof scene.duration === "number"
          ? Math.max(0.1, scene.duration)
          : Math.max(0.1, parseFloat(String(scene.duration)) || 3);

      // FIXED ANIMATION DETECTION
      // Convert animation settings to consistent format
      // An animated scene is one with a videoUrl that isn't explicitly disabled
      const useAnimation = scene.videoUrl && scene.animate !== false;

      console.log(`Scene ${index + 1} processing:`, {
        id: scene.id,
        animate: scene.animate,
        videoUrl: scene.videoUrl ? "exists" : "none",
        animationStatus: scene.animationStatus,
        useAnimation: useAnimation,
        duration: validDuration,
      });

      return {
        ...scene,
        // Clear and explicit animation decision
        animate: useAnimation,
        // Ensure duration is a valid number
        duration: validDuration,
      };
    });

    // Log information about the merged scenes
    console.log(
      `Created ${processedScenes.length} merged scenes with data from both client and database`
    );
    console.log(`Total scenes to render: ${processedScenes.length}`);
    console.log(`Scene animation status summary:`);

    // Calculate total duration
    const totalDuration = processedScenes.reduce(
      (total, scene) => total + (scene.duration || 3),
      0
    );

    console.log(`Total video duration: ${totalDuration}s`);

    processedScenes.forEach((scene, index) => {
      console.log(`Scene ${index + 1}: ${scene.id}`, {
        animate: scene.animate,
        status: scene.animationStatus,
        videoUrl: scene.videoUrl ? "present" : "missing",
        duration: scene.duration + "s",
      });
    });

    // Force FFmpeg rendering in development mode if FORCE_RENDER=true
    const forceRender = process.env.FORCE_RENDER === "true";

    try {
      // Use mock export in development mode unless forced to render
      const useMockExport =
        process.env.NODE_ENV === "development" && !forceRender;

      if (useMockExport) {
        console.log("Using mock video export (FFmpeg bypassed)");

        // Log the fact that you could use real FFmpeg rendering
        console.log(
          "To use real FFmpeg rendering, set FORCE_RENDER=true in environment"
        );

        // Create a small static video file for testing
        // This is a base64-encoded minimal valid MP4 file (only a few bytes)
        const base64Mp4 =
          "AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tAAAAH21vb3YAAABsbXZoZAAAAADaAE8D2gBPAwAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIYdHJhawAAAFx0a2hkAAAAB9oATwPaAE8DAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAACgAAAAWgAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABANoATwMAAAAAAAEAAAAAAbWbWRpYQAAACBtZGhkAAAAANoATwPaAE8DAAAAAAAAAAAAAAAAAAAA////SAAAAg1wcm90b19wbGF5ZXJfbWluaW1hbC5qcw0NCgA=";
        const videoBuffer = Buffer.from(base64Mp4, "base64");

        // Return the mock video
        const response = new NextResponse(videoBuffer);
        response.headers.set("Content-Type", "video/mp4");
        response.headers.set(
          "Content-Disposition",
          `attachment; filename="${projectId}-mock.mp4"`
        );
        return response;
      }

      // Start the actual video rendering process
      console.log(
        `Starting video rendering with ${processedScenes.length} scenes`
      );
      const videoFilePath = await videoService.renderVideo({
        projectId,
        scenes: processedScenes,
        format,
        quality,
      });

      // Check for the file with duration in filename
      let actualVideoFilePath = videoFilePath;
      if (!fs.existsSync(videoFilePath)) {
        console.log("Video file not found at expected path:", videoFilePath);

        // Try with duration in filename
        const durationPath = videoFilePath.replace(
          ".mp4",
          `-${totalDuration}s.mp4`
        );
        if (fs.existsSync(durationPath)) {
          console.log("Found video with duration in filename:", durationPath);
          actualVideoFilePath = durationPath;
        } else {
          // Look for any MP4 in the directory as last resort
          const dir = path.dirname(videoFilePath);
          const files = fs.readdirSync(dir);
          console.log(`Looking for MP4 files in ${dir}:`, files);

          const mp4File = files.find((f) => f.endsWith(".mp4"));
          if (mp4File) {
            actualVideoFilePath = path.join(dir, mp4File);
            console.log("Found alternative video file:", actualVideoFilePath);
          }
        }
      }

      // Read the file to return it
      console.log("Reading video from:", actualVideoFilePath);
      if (!fs.existsSync(actualVideoFilePath)) {
        console.error(
          `Error: Output video file not found at: ${actualVideoFilePath}`
        );
        return NextResponse.json(
          { error: "Failed to create video file" },
          { status: 500 }
        );
      }

      const videoBuffer = await fs.promises.readFile(actualVideoFilePath);

      // Upload video to S3
      try {
        const userId =
          process.env.NODE_ENV === "development"
            ? "dev-user-id"
            : "auth-user-id";
        const videoFilename = `exported_video_${projectId}_${Date.now()}.mp4`;
        const bucket = s3Utils.getBucketForAssetType("export");
        const key = s3Utils.generateAssetKey(userId, videoFilename, "export");

        console.log("Uploading rendered video to S3:", { bucket, key });

        // Upload to S3
        await s3Utils.uploadBufferToS3(bucket, key, videoBuffer, "video/mp4");

        // Generate S3 URL
        const s3Url = s3Utils.generateS3Url(bucket, key);

        console.log("Video uploaded to S3:", s3Url);

        // Clean up the temporary file
        try {
          await fs.promises.unlink(actualVideoFilePath);
          console.log("Cleaned up temporary video file");
        } catch (cleanupError) {
          console.error(
            "Failed to clean up temporary video file:",
            cleanupError
          );
        }

        // Return S3 URL instead of file download
        return NextResponse.json({
          success: true,
          videoUrl: s3Url,
          fileSize: videoBuffer.length,
          duration: totalDuration,
          format: format,
          timestamp: new Date().toISOString(),
        });
      } catch (s3Error) {
        console.error(
          "Failed to upload video to S3, falling back to direct download:",
          s3Error
        );

        // Fallback to direct download if S3 upload fails
        const response = new NextResponse(videoBuffer);
        response.headers.set("Content-Type", "video/mp4");
        response.headers.set(
          "Content-Disposition",
          `attachment; filename="${projectId}.mp4"`
        );

        // Clean up the temporary file
        try {
          await fs.promises.unlink(actualVideoFilePath);
          console.log("Cleaned up temporary video file");
        } catch (cleanupError) {
          console.error(
            "Failed to clean up temporary video file:",
            cleanupError
          );
        }

        return response;
      }
    } catch (renderingError: unknown) {
      console.error("Error rendering video:", renderingError);

      // Safely extract error message
      const errorMessage =
        renderingError instanceof Error
          ? renderingError.message
          : "Unknown rendering error";

      return NextResponse.json(
        { error: "Failed to render video", details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error processing video export:", error);

    return NextResponse.json(
      { error: "Internal server error during video export" },
      { status: 500 }
    );
  }
}

// Handle HEAD requests to check if the endpoint is available
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
    },
  });
}
