import { NextResponse } from "next/server";
import { z } from "zod";
import { videoAnimationService } from "@/app/utils/video-animation";
import { prisma } from "@/app/utils/db";
import fs from "fs";
import path from "path";

// Schema for animation requests
// Schema for animation requests - modified to accept relative URLs
const AnimationRequestSchema = z.object({
  sceneId: z.string(),
  // Accept both relative and absolute URLs
  imageUrl: z.string(),
  prompt: z.string(),
  duration: z.number().min(0.1).max(60).default(5), // Default to 5 seconds
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

    // Enhanced logging of the animation generation request
    console.log("🎬 ANIMATION GENERATION API - REQUEST RECEIVED:");
    console.log(
      "================================================================"
    );
    console.log("Full Request Body:", JSON.stringify(body, null, 2));
    console.log("Scene ID:", body.sceneId);
    console.log("Image URL:", body.imageUrl);
    console.log("Animation Prompt:", body.prompt);
    console.log("Duration:", body.duration);
    console.log("Request Timestamp:", new Date().toISOString());
    console.log(
      "================================================================"
    );

    // Validate request
    try {
      body = AnimationRequestSchema.parse(body);
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

    const { sceneId, imageUrl, prompt, duration } = body;

    try {
      // Fetch the scene to get existing data
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: { project: true },
      });

      if (!scene) {
        return NextResponse.json({ error: "Scene not found" }, { status: 404 });
      }

      // Log the scene data from database
      console.log("📊 SCENE DATA FROM DATABASE:");
      console.log(
        "================================================================"
      );
      console.log("Scene ID:", scene.id);
      console.log("Scene Order:", scene.order);
      console.log("Scene Duration:", scene.duration);
      console.log("Scene Image URL:", scene.imageUrl);
      console.log("Scene Prompt:", scene.prompt);
      console.log("Scene Animation Prompt:", scene.animationPrompt);
      console.log("Scene Animation Status:", scene.animationStatus);
      console.log("Scene Video URL:", scene.videoUrl);
      console.log("Project ID:", scene.project?.id);
      console.log("Project Format:", scene.project?.format);
      console.log("Complete Scene Object:", JSON.stringify(scene, null, 2));
      console.log(
        "================================================================"
      );

      // Generate animation prompt if empty or missing
      let animationPrompt = prompt;
      if (!animationPrompt || animationPrompt.trim() === "") {
        // Create animation prompt based on original scene prompt
        const originalPrompt = scene.prompt || "";
        if (originalPrompt) {
          // Transform the static description into an animation prompt
          animationPrompt = `${originalPrompt}. Add subtle camera movement, gentle parallax motion of background elements, and natural atmospheric effects like floating particles or light rays. Create a cinematic feel with smooth, slow movements.`;
          console.log(
            `Generated animation prompt: ${animationPrompt.substring(0, 100)}...`
          );
        } else {
          animationPrompt =
            "Add subtle camera movement and gentle motion to bring the scene to life with cinematic atmosphere.";
        }
      }

      // Calculate proper video dimensions based on project format
      let width = 1024;
      let height = 1024;
      const format = scene.project?.format || "9:16";

      switch (format) {
        case "9:16":
          width = 576;
          height = 1024;
          break;
        case "16:9":
          width = 1024;
          height = 576;
          break;
        case "1:1":
          width = 1024;
          height = 1024;
          break;
        case "4:5":
          width = 819;
          height = 1024;
          break;
        default:
          width = 1024;
          height = 1024;
      }

      console.log(
        `Using video dimensions: ${width}x${height} for format ${format}`
      );

      // Try to update the scene status to processing
      try {
        await prisma.scene.update({
          where: { id: sceneId },
          data: {
            animationStatus: "processing",
            animationPrompt: prompt,
          },
        });
        console.log(`Scene ${sceneId} marked as processing animation`);
      } catch (updateError) {
        console.error(
          "Error updating scene status to processing:",
          updateError
        );

        // Fallback to direct SQL update with proper parameter escaping
        try {
          await prisma.$executeRaw`
            UPDATE "Scene" 
            SET "animationStatus" = 'processing', 
                "animationPrompt" = ${prompt}
            WHERE "id" = ${sceneId}
          `;
          console.log(
            `Scene ${sceneId} marked as processing animation via direct SQL`
          );
        } catch (sqlError) {
          console.error(
            "Failed to update processing status via direct SQL:",
            sqlError
          );
          // Continue anyway since this is just status tracking
        }
      }

      // Handle relative URLs by converting them to absolute file paths
      if (imageUrl.startsWith("/")) {
        // For server-side processing, convert to absolute path
        const absolutePath = path.join(process.cwd(), "public", imageUrl);

        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
          return NextResponse.json(
            {
              error: "Image file not found",
              details: `The file at ${imageUrl} could not be found on the server.`,
            },
            { status: 404 }
          );
        }

        // For debugging, we'll log the absolute path
        console.log(`Using local file for animation: ${absolutePath}`);
      }
      // Check if the image URL is a blob URL which can't be processed
      if (imageUrl.startsWith("blob:")) {
        // Update the scene to mark the animation as failed
        await prisma.scene.update({
          where: { id: sceneId },
          data: {
            animationStatus: "failed",
          },
        });

        return NextResponse.json(
          {
            error: "Cannot animate using blob URLs.",
            details: "Please upload the image properly to the server first.",
          },
          { status: 400 }
        );
      }

      // Also add a check for local file paths
      if (imageUrl.startsWith("file:")) {
        await prisma.scene.update({
          where: { id: sceneId },
          data: {
            animationStatus: "failed",
          },
        });

        return NextResponse.json(
          {
            error: "Cannot animate using local file paths.",
            details: "Please upload the image properly to the server first.",
          },
          { status: 400 }
        );
      }

      // Generate the animation using the video animation service
      // Use the original prompt from the user's input, not the auto-generated one
      const finalPromptToUse = prompt || animationPrompt;

      const animationFilePath = await videoAnimationService.generateAnimation({
        imageUrl,
        imagePrompt: finalPromptToUse,
        duration,
        // Using the default values from the schema
        width: 512,
        height: 512,
        fps: 24,
        format: "mp4",
      });

      console.log(`Animation generated at: ${animationFilePath}`);

      // Get the final prompt that was processed and sent to Runway
      const finalPrompt =
        videoAnimationService.getLastProcessedPrompt() || finalPromptToUse;
      console.log(`Final prompt sent to Runway: ${finalPrompt}`);

      // Get the original Runway animation URL from the videoAnimationService
      // This is the URL returned by Runway before we download it
      const runwayAnimationUrl = videoAnimationService.getLastAnimationUrl();

      if (!runwayAnimationUrl) {
        console.error("No Runway animation URL available");
        return NextResponse.json(
          { error: "Failed to get Runway animation URL" },
          { status: 500 }
        );
      }

      console.log(`Using original Runway animation URL: ${runwayAnimationUrl}`);

      // Upload the downloaded video to S3
      let finalVideoUrl = runwayAnimationUrl;
      try {
        const { s3Utils } = await import("@/lib/s3-utils");

        // Generate a unique key for the video
        const videoKey = `animations/scene-${sceneId}-${Date.now()}.mp4`;
        const bucket = s3Utils.buckets.videos;

        console.log(`Uploading animation to S3: ${bucket}/${videoKey}`);

        // Upload the downloaded video file to S3
        await s3Utils.uploadToS3(bucket, videoKey, animationFilePath);

        // Generate the S3 URL
        finalVideoUrl = s3Utils.generateS3Url(bucket, videoKey);

        console.log(`Animation uploaded to S3 successfully: ${finalVideoUrl}`);

        // Clean up the temporary animation file after successful upload
        try {
          const fs = await import("fs");
          await fs.promises.unlink(animationFilePath);
          console.log(`Cleaned up temporary animation file: ${animationFilePath}`);
        } catch (cleanupError) {
          console.error("Failed to clean up temporary animation file:", cleanupError);
        }
      } catch (s3Error) {
        console.error("Error uploading animation to S3:", s3Error);
        console.log("Falling back to original Runway URL");
        
        // Clean up the temporary file even on S3 upload failure
        try {
          const fs = await import("fs");
          await fs.promises.unlink(animationFilePath);
          console.log(`Cleaned up temporary animation file after S3 failure: ${animationFilePath}`);
        } catch (cleanupError) {
          console.error("Failed to clean up temporary animation file:", cleanupError);
        }
        // Continue with Runway URL as fallback
      }

      // Save the S3 URL (or Runway URL as fallback) to the database
      try {
        await prisma.scene.update({
          where: { id: sceneId },
          data: {
            videoUrl: finalVideoUrl,
            animationStatus: "completed",
            animationPrompt: finalPrompt, // Save the final prompt that was sent to Runway
          },
        });

        console.log(
          `Scene ${sceneId} updated with video URL ${finalVideoUrl} and final prompt: ${finalPrompt}`
        );
      } catch (dbError) {
        console.error("Error updating scene with animation URL:", dbError);

        // Try alternative update methods if the first one fails
        try {
          await prisma.$executeRaw`
            UPDATE "Scene" 
            SET "videoUrl" = ${finalVideoUrl}, 
                "animationStatus" = 'completed',
                "animationPrompt" = ${finalPrompt}
            WHERE "id" = ${sceneId}
          `;
          console.log(
            `Scene ${sceneId} updated with video URL and final prompt using raw SQL`
          );
        } catch (rawSqlError) {
          console.error("Error updating scene with raw SQL:", rawSqlError);
          return NextResponse.json(
            { error: "Failed to update scene with animation URL" },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        sceneId,
        videoUrl: finalVideoUrl,
        animationStatus: "completed",
        finalPrompt, // Include the final prompt in the response
      });
    } catch (animationError: unknown) {
      console.error("Animation generation error:", animationError);

      // Update the scene to mark the animation as failed
      try {
        await prisma.scene.update({
          where: { id: sceneId },
          data: {
            animationStatus: "failed",
          },
        });
        console.log(`Scene ${sceneId} marked as failed animation`);
      } catch (updateError) {
        console.error("Error updating scene status:", updateError);

        // Fallback to direct SQL update with proper parameter escaping
        try {
          await prisma.$executeRaw`
            UPDATE "Scene" 
            SET "animationStatus" = 'failed'
            WHERE "id" = ${sceneId}
          `;
          console.log(
            `Scene ${sceneId} marked as failed animation via direct SQL`
          );
        } catch (sqlError) {
          console.error(
            "Failed to update failed status via direct SQL:",
            sqlError
          );
        }
      }

      return NextResponse.json(
        {
          error: "Failed to generate animation",
          details:
            animationError instanceof Error
              ? animationError.message
              : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error during animation generation:", error);

    return NextResponse.json(
      { error: "Internal server error during animation generation" },
      { status: 500 }
    );
  }
}
