import { NextRequest, NextResponse } from "next/server";
import { videoService } from "@/app/utils/video/video-service";
import { s3Utils } from "@/lib/s3-utils";
import fs from "fs";

/**
 * Server-side API endpoint for video rendering
 * This isolates Node.js specific code to the server
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const options = await request.json();

    // Validate that we have required data
    if (!options.scenes || !options.projectId) {
      return NextResponse.json(
        { error: "Missing required data: scenes or projectId" },
        { status: 400 }
      );
    }

    console.log(
      `Rendering video for project ${options.projectId} with ${options.scenes.length} scenes`
    );

    // Use the server-side video service to render the video
    const outputPath = await videoService.renderVideo(options);

    // Upload to S3 if file exists
    try {
      if (fs.existsSync(outputPath)) {
        const userId =
          process.env.NODE_ENV === "development"
            ? "dev-user-id"
            : "auth-user-id";
        const videoFilename = `rendered_video_${options.projectId}_${Date.now()}.mp4`;
        const bucket = s3Utils.getBucketForAssetType("export");
        const key = s3Utils.generateAssetKey(userId, videoFilename, "export");

        console.log("Uploading rendered video to S3:", { bucket, key });

        // Upload to S3
        await s3Utils.uploadToS3(bucket, key, outputPath);

        // Generate S3 URL
        const s3Url = s3Utils.generateS3Url(bucket, key);

        console.log("Video uploaded to S3:", s3Url);

        // Clean up local file
        try {
          await fs.promises.unlink(outputPath);
          console.log("Cleaned up local video file");
        } catch (cleanupError) {
          console.error("Failed to clean up local video file:", cleanupError);
        }

        // Return S3 URL
        return NextResponse.json({
          outputPath: s3Url,
          localPath: outputPath,
          s3Url: s3Url,
          uploadedToS3: true,
        });
      } else {
        console.warn("Video file not found at output path:", outputPath);
        return NextResponse.json({ outputPath, uploadedToS3: false });
      }
    } catch (s3Error) {
      console.error("Failed to upload video to S3:", s3Error);
      // Return local path as fallback
      return NextResponse.json({
        outputPath,
        s3Error:
          s3Error instanceof Error ? s3Error.message : "Unknown S3 error",
        uploadedToS3: false,
      });
    }
  } catch (error: any) {
    console.error("Error in video render API:", error);
    return NextResponse.json(
      {
        error:
          error.message || "An unknown error occurred during video rendering",
      },
      { status: 500 }
    );
  }
}
