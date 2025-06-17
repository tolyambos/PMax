// src/app/utils/video/image-processor.ts
import fs from "fs";
import path from "path";
import axios from "axios";
import { s3Utils } from "@/lib/s3-utils";
import { SceneProcessingResult, VideoDimensions } from "./types";

/**
 * Handles image processing for video creation
 */
export class ImageProcessor {
  /**
   * Download an image from a URL
   */
  public async downloadImage(
    imageUrl: string,
    outputPath: string
  ): Promise<string> {
    try {
      console.log(`Downloading image from: ${imageUrl}`);

      // Handle data URLs
      if (imageUrl.startsWith("data:image")) {
        const base64Data = imageUrl.split(",")[1];
        fs.writeFileSync(outputPath, Buffer.from(base64Data, "base64"));
        console.log(`Saved data URL as image to: ${outputPath}`);
        return outputPath;
      }

      // Handle local file paths (URLs without protocol or starting with /)
      if (
        imageUrl.startsWith("/") ||
        (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))
      ) {
        // If it's a relative path, check if the file exists in the public directory
        let fullPath = imageUrl;

        if (imageUrl.startsWith("/")) {
          fullPath = path.join(process.cwd(), "public", imageUrl);
        } else {
          // If it doesn't start with /, assume it's relative to public
          fullPath = path.join(process.cwd(), "public", "/", imageUrl);
        }

        // Check if the file exists
        if (fs.existsSync(fullPath)) {
          console.log(`Found local file at ${fullPath}`);
          // Copy the file to the output path
          fs.copyFileSync(fullPath, outputPath);
          console.log(`Copied local file to: ${outputPath}`);
          return outputPath;
        } else {
          console.error(`Local file not found: ${fullPath}`);
          throw new Error(`Local file not found: ${imageUrl}`);
        }
      }

      // Handle blob URLs - these cannot be processed by the server
      if (imageUrl.startsWith("blob:")) {
        throw new Error(
          "Blob URLs cannot be processed by the server. Please upload the file first."
        );
      }

      // Check if this is an S3 URL and handle presigned URLs
      if (this.isS3Url(imageUrl)) {
        try {
          const downloadUrl = await this.getS3DownloadUrl(imageUrl);
          console.log(`Using S3 download URL for: ${imageUrl}`);

          const response = await fetch(downloadUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to download S3 image: ${response.status} ${response.statusText}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
          console.log(`Downloaded S3 image to: ${outputPath}`);

          return outputPath;
        } catch (s3Error) {
          console.error(`S3 download failed, trying direct URL:`, s3Error);
          // Fall through to regular HTTP handling
        }
      }

      // Regular HTTP/HTTPS URLs
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to download image: ${response.status} ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
      console.log(`Downloaded image to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error(`Error downloading image from ${imageUrl}:`, error);
      throw error;
    }
  }

  /**
   * Download a video file from a URL
   */
  public async downloadVideo(
    videoUrl: string,
    outputPath: string
  ): Promise<string> {
    try {
      console.log(`Downloading video from: ${videoUrl}`);

      // Check if this is an S3 URL and handle presigned URLs
      if (this.isS3Url(videoUrl)) {
        try {
          const downloadUrl = await this.getS3DownloadUrl(videoUrl);
          console.log(`Using S3 download URL for video: ${videoUrl}`);

          const response = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
          });

          fs.writeFileSync(outputPath, Buffer.from(response.data));
          console.log(`Downloaded S3 video to: ${outputPath}`);

          return outputPath;
        } catch (s3Error) {
          console.error(
            `S3 video download failed, trying direct URL:`,
            s3Error
          );
          // Fall through to regular HTTP handling
        }
      }

      // Download the video file
      const response = await axios.get(videoUrl, {
        responseType: "arraybuffer",
      });

      fs.writeFileSync(outputPath, Buffer.from(response.data));
      console.log(`Downloaded video to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error(`Error downloading video from ${videoUrl}:`, error);
      throw new Error(
        `Failed to download video: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Process all scenes and download their images/videos
   */
  public async processScenes(
    scenes: any[],
    tempDir: string,
    dimensions: VideoDimensions
  ): Promise<SceneProcessingResult[]> {
    const results: SceneProcessingResult[] = [];

    console.log(`Processing ${scenes.length} scenes...`);

    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      try {
        const scene = scenes[sceneIndex];

        // FIXED ANIMATION DETECTION - Strict logic to respect user choices
        // Use animation if:
        // 1. We have a videoUrl AND
        // 2. animate is explicitly true AND
        // 3. animationStatus is not "none" (respects user toggle OFF)
        const useAnimatedVersion =
          scene.videoUrl &&
          scene.animate === true &&
          scene.animationStatus !== "none";

        console.log(
          `Processing scene ${sceneIndex}: ${JSON.stringify({
            id: scene.id,
            hasImageUrl: !!scene.imageUrl,
            hasVideoUrl: !!scene.videoUrl,
            animate: scene.animate,
            animationStatus: scene.animationStatus,
            useAnimatedVersion: useAnimatedVersion,
            hasElements: !!scene.elements,
            elementCount: scene.elements?.length || 0,
            duration: scene.duration || 3,
          })}`
        );

        // Ensure duration is properly converted to a number for all paths
        const sceneDuration =
          typeof scene.duration === "number"
            ? scene.duration
            : parseFloat(String(scene.duration)) || 3;

        // Use the animated video version if available and not explicitly disabled
        if (useAnimatedVersion) {
          try {
            console.log(
              `Using animated video for scene ${sceneIndex}: ${scene.videoUrl}`
            );
            const videoOutputPath = path.join(
              tempDir,
              `scene-${sceneIndex.toString().padStart(3, "0")}-original.mp4`
            );

            // Try to download the video
            await this.downloadVideo(scene.videoUrl, videoOutputPath);

            console.log(
              `Using animated video for scene ${sceneIndex} with duration: ${sceneDuration}s`
            );

            // If video download succeeds, use it
            results.push({
              index: sceneIndex,
              outputPath: videoOutputPath,
              isVideo: true,
              duration: sceneDuration,
              elements: scene.elements,
            });

            // Continue to next scene
            continue;
          } catch (videoError) {
            // Video download failed, log it but don't throw - we'll fall back to image
            console.error(
              `Error downloading video from ${scene.videoUrl}: ${videoError}`
            );
            console.log(`Falling back to image URL for scene ${sceneIndex}`);
            // Continue and try to use the image URL instead
          }
        } else {
          console.log(
            `Scene ${sceneIndex} is set to use non-animated version (static image)`
          );
        }

        // IMPORTANT: At this point, we're using static image approach
        // This handles both cases:
        // 1. When animation was requested but failed to download
        // 2. When animation was not requested

        // If we have an image URL, use it
        if (scene.imageUrl) {
          const imageOutputPath = path.join(
            tempDir,
            `scene-${sceneIndex.toString().padStart(3, "0")}-original.jpg`
          );

          try {
            await this.downloadImage(scene.imageUrl, imageOutputPath);

            console.log(
              `Using static image for scene ${sceneIndex} with duration: ${sceneDuration}s`
            );

            results.push({
              index: sceneIndex,
              outputPath: imageOutputPath,
              isVideo: false,
              duration: sceneDuration,
              elements: scene.elements,
            });
          } catch (imageError) {
            console.error(
              `Failed to download image: ${imageError instanceof Error ? imageError.message : String(imageError)}`
            );

            // Create a placeholder if image download fails
            const placeholderPath = path.join(
              tempDir,
              `scene-${sceneIndex.toString().padStart(3, "0")}-base.jpg`
            );

            this.createPlaceholderImage(
              placeholderPath,
              dimensions,
              sceneIndex
            );

            console.log(
              `Created placeholder for scene ${sceneIndex} with duration: ${sceneDuration}s`
            );

            results.push({
              index: sceneIndex,
              outputPath: placeholderPath,
              isVideo: false,
              duration: sceneDuration,
              elements: scene.elements,
            });
          }
        } else {
          // No image URL either, create a placeholder
          const placeholderPath = path.join(
            tempDir,
            `scene-${sceneIndex.toString().padStart(3, "0")}-base.jpg`
          );

          this.createPlaceholderImage(placeholderPath, dimensions, sceneIndex);

          console.log(
            `Created placeholder for scene ${sceneIndex} with duration: ${sceneDuration}s`
          );

          results.push({
            index: sceneIndex,
            outputPath: placeholderPath,
            isVideo: false,
            duration: sceneDuration,
            elements: scene.elements,
          });
        }
      } catch (error) {
        console.error(`Error processing scene ${sceneIndex}:`, error);

        // Create a placeholder for the error
        const placeholderPath = path.join(
          tempDir,
          `scene-${sceneIndex.toString().padStart(3, "0")}-base.jpg`
        );

        this.createErrorPlaceholder(
          placeholderPath,
          dimensions,
          sceneIndex,
          error instanceof Error ? error.message : String(error)
        );

        // Add result with placeholder and ensure duration is handled
        const sceneDuration = scenes[sceneIndex]?.duration
          ? typeof scenes[sceneIndex].duration === "number"
            ? scenes[sceneIndex].duration
            : parseFloat(String(scenes[sceneIndex].duration))
          : 3;

        results.push({
          index: sceneIndex,
          outputPath: placeholderPath,
          isVideo: false,
          duration: sceneDuration,
          elements: scenes[sceneIndex].elements,
        });
      }
    }

    // Verify we have processed all scenes
    console.log(
      `Processed ${results.length} scenes (original count: ${scenes.length})`
    );

    // Make sure we have at least one scene
    if (results.length === 0 && scenes.length > 0) {
      console.warn(
        "No scenes were successfully processed - creating a fallback placeholder scene"
      );

      const placeholderPath = path.join(tempDir, "fallback-scene.jpg");
      this.createPlaceholderImage(placeholderPath, dimensions, 0);

      results.push({
        index: 0,
        outputPath: placeholderPath,
        isVideo: false,
        duration: 3,
        elements: [],
      });
    }

    return results;
  }

  /**
   * Create a placeholder image for a scene
   */
  private createPlaceholderImage(
    outputPath: string,
    dimensions: VideoDimensions,
    sceneIndex: number
  ): void {
    // This is simplified - in a real implementation, you would use node-canvas
    // or a similar library to create an actual image

    // Instead, we'll create a simple text file that ffmpeg can convert
    const placeholderContent = `
      # FFmpeg placeholder generator
      color=c=black:s=${dimensions.width}x${dimensions.height}
      drawtext=text='Scene ${sceneIndex + 1}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2
    `;

    const tempTextPath = `${outputPath}.txt`;
    fs.writeFileSync(tempTextPath, placeholderContent);

    // Use ffmpeg to create a placeholder image
    const { execSync } = require("child_process");
    execSync(
      `ffmpeg -f lavfi -i color=c=black:s=${dimensions.width}x${dimensions.height} -vf "drawtext=text='Scene ${sceneIndex + 1}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2" -frames:v 1 ${outputPath}`
    );

    // Clean up
    fs.unlinkSync(tempTextPath);

    console.log(
      `Created placeholder image for scene ${sceneIndex}: ${outputPath}`
    );
  }

  /**
   * Create an error placeholder image
   */
  private createErrorPlaceholder(
    outputPath: string,
    dimensions: VideoDimensions,
    sceneIndex: number,
    errorMessage: string
  ): void {
    // Use ffmpeg to create an error placeholder
    const { execSync } = require("child_process");

    // Sanitize error message for shell command - remove problematic characters
    // Better solution than just replacing quotes which can cause shell injection issues
    const sanitizedError = errorMessage
      .replace(/[^a-zA-Z0-9 .,_-]/g, "") // Keep only alphanumeric and some safe punctuation
      .substring(0, 40); // Limit length to avoid overflow

    try {
      execSync(
        `ffmpeg -f lavfi -i color=c=darkred:s=${dimensions.width}x${dimensions.height} ` +
          `-vf "drawtext=text='Scene ${sceneIndex + 1} Error':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2-24" ` +
          `-frames:v 1 ${outputPath}`
      );

      console.log(
        `Created error placeholder for scene ${sceneIndex}: ${outputPath}`
      );
    } catch (e) {
      // If FFmpeg fails for any reason, create a simple text file as fallback
      console.error(`FFmpeg error creating placeholder:`, e);
      const fallbackContent = `Error in scene ${sceneIndex + 1}: ${sanitizedError}`;
      fs.writeFileSync(outputPath, fallbackContent);
      console.log(`Created fallback text error for scene ${sceneIndex}`);
    }
  }

  /**
   * Check if a URL is an S3 URL
   */
  private isS3Url(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Check for common S3 URL patterns
      return (
        urlObj.hostname.includes("s3.") ||
        urlObj.hostname.includes(".s3.") ||
        urlObj.hostname.includes("wasabisys.com") ||
        urlObj.hostname.endsWith(".amazonaws.com")
      );
    } catch {
      return false;
    }
  }

  /**
   * Get a download URL for S3 assets (generate presigned URL if needed)
   */
  private async getS3DownloadUrl(s3Url: string): Promise<string> {
    try {
      // If the URL already has query parameters, it's likely a presigned URL
      const urlObj = new URL(s3Url);
      if (
        urlObj.searchParams.has("X-Amz-Signature") ||
        urlObj.searchParams.has("AWSAccessKeyId")
      ) {
        console.log("URL appears to be a presigned URL, using directly");
        return s3Url;
      }

      // Extract bucket and key from S3 URL
      const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(s3Url);

      // Generate presigned URL
      const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
      console.log("Generated presigned URL for S3 asset");

      return presignedUrl;
    } catch (error) {
      console.error("Failed to generate S3 download URL:", error);
      // Return original URL as fallback
      return s3Url;
    }
  }
}

// Create and export a singleton instance
export const imageProcessor = new ImageProcessor();
