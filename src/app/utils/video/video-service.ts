import path from "path";
import os from "os";
import fs from "fs";
import { fontManager } from "./font-manager";
import { ffmpegRenderer } from "./ffmpeg-renderer";
import { imageProcessor } from "./image-processor";
import { elementRenderer } from "./element-renderer";
import {
  VideoRenderOptions,
  VideoRenderOptionsSchema,
  FrameListEntry,
  Scene,
} from "./types";
import { GOOGLE_FONTS } from "../fonts-server";

/**
 * Main video rendering service - Fixed implementation
 */
export class VideoService {
  constructor() {
    // Initialize the element renderer

    // Set available fonts on the font manager
    fontManager.setAvailableFonts(GOOGLE_FONTS);

    console.log("VideoService initialized");
  }

  /**
   * Sanitize a string to create a safe filename
   */
  private sanitizeFilename(input: string): string {
    // Replace any characters that might cause issues with underscores
    return input.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  /**
   * Ensure directory exists and is writable
   */
  private ensureDirectoryExists(dirPath: string): void {
    // Make sure the directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Verify we can write to it by creating a test file
    const testPath = path.join(dirPath, ".write-test");
    try {
      fs.writeFileSync(testPath, "test");
      fs.unlinkSync(testPath); // Remove test file
    } catch (error) {
      console.error(`Directory ${dirPath} is not writable:`, error);
      throw new Error(`Cannot write to output directory: ${dirPath}`);
    }
  }

  /**
   * Render a video from a sequence of scenes
   */
  public async renderVideo(options: VideoRenderOptions): Promise<string> {
    let tempDir = "";

    try {
      console.log("Starting video rendering");

      // Create a render directory in the project root rather than using system temp
      const timestamp = Date.now();
      const projectRoot = process.cwd();
      tempDir = path.join(projectRoot, "renders", `render-${timestamp}`);

      try {
        this.ensureDirectoryExists(tempDir);
        console.log(`Created render directory: ${tempDir}`);
      } catch (error) {
        console.error(`Failed to create directory at ${tempDir}:`, error);
        // Fall back to a directory in the home folder
        const homeDir = os.homedir();
        tempDir = path.join(homeDir, "pmax-renders", `render-${timestamp}`);
        this.ensureDirectoryExists(tempDir);
        console.log(`Created alternative render directory: ${tempDir}`);
      }

      // Validate the options
      const validatedOptions = VideoRenderOptionsSchema.parse(options);
      const { scenes, format, quality, projectId } = validatedOptions;

      if (!scenes || scenes.length === 0) {
        throw new Error("No scenes provided for video rendering");
      }

      console.log(
        `Rendering video for project ${projectId} with ${scenes.length} scenes`
      );

      // Log each scene for debugging
      scenes.forEach((scene, index) => {
        console.log(
          `[VIDEO-SERVICE] Scene ${index}: ID=${scene.id}, duration=${scene.duration}s (type: ${typeof scene.duration}), animate=${scene.animate}, animationStatus=${scene.animationStatus}, videoUrl=${scene.videoUrl ? "exists" : "none"}`
        );
      });

      // Get dimensions based on format
      const dimensions = this.getDimensionsFromFormat(format);

      // Get quality settings
      const qualitySettings = this.getQualitySettings(quality);

      // Process all scenes - download images/videos and prepare for rendering
      console.log("Processing scenes...");
      const processedScenes = await imageProcessor.processScenes(
        scenes,
        tempDir,
        dimensions
      );

      console.log(`Processed ${processedScenes.length} scenes for rendering`);

      // Calculate expected total duration
      const expectedTotalDuration = processedScenes.reduce(
        (total, scene) => total + scene.duration,
        0
      );
      console.log(
        `Expected total video duration: ${expectedTotalDuration.toFixed(2)}s`
      );

      // Process each scene - apply elements as filters
      console.log("Applying elements to scenes...");
      const frameList: FrameListEntry[] = [];

      for (const processedScene of processedScenes) {
        const { index, outputPath, isVideo, duration, elements } =
          processedScene;

        // Use simple filenames with just scene number and extension
        const sceneIndex = index.toString().padStart(3, "0");
        const finalPath = path.join(
          tempDir,
          `scene-${sceneIndex}.${isVideo ? "mp4" : "jpg"}`
        );

        // If we have elements to render, process them
        if (elements && elements.length > 0) {
          console.log(
            `Processing ${elements.length} elements for scene ${index}`
          );

          // Generate filter commands for elements
          const filterCommands = await elementRenderer.processSceneElements(
            elements,
            dimensions.width,
            dimensions.height,
            index,
            format
          );

          if (filterCommands.length > 0) {
            console.log(
              `Generated ${filterCommands.length} filter commands for scene ${index}`
            );

            // Apply filters to the scene
            if (isVideo) {
              // Apply filters to video
              try {
                await ffmpegRenderer.applyFiltersToVideo(
                  outputPath,
                  finalPath,
                  filterCommands,
                  dimensions,
                  qualitySettings
                );
              } catch (error) {
                console.error(
                  `Error applying filters to video scene ${index}:`,
                  error
                );
                // Just copy original file on failure
                fs.copyFileSync(outputPath, finalPath);
              }
            } else {
              // Apply filters to image
              try {
                await ffmpegRenderer.applyFiltersToImage(
                  outputPath,
                  finalPath,
                  filterCommands
                );
              } catch (error) {
                console.error(
                  `Error applying filters to image scene ${index}:`,
                  error
                );
                // Just copy original file on failure
                fs.copyFileSync(outputPath, finalPath);
              }
            }
          } else {
            // No filters to apply, just copy the file
            fs.copyFileSync(outputPath, finalPath);
          }
        } else {
          // No elements to render, just copy the file
          fs.copyFileSync(outputPath, finalPath);
        }

        // Add to frame list - ensure duration is a proper number
        // CRITICAL FIX: Ensure non-zero duration (minimum 0.1s)
        const sceneDuration = Math.max(
          0.1,
          typeof duration === "number"
            ? duration
            : parseFloat(String(duration)) || 3
        );

        console.log(
          `Adding scene ${index} to frame list: ${finalPath} (duration: ${sceneDuration}s)`
        );

        frameList.push({
          filePath: finalPath,
          duration: sceneDuration,
        });
      }

      // Compute total duration for logging and potentially filename
      const actualTotalDuration = frameList.reduce(
        (total, frame) => total + frame.duration,
        0
      );

      // Use a filename that includes duration for easier debugging
      const outputFile = path.join(
        tempDir,
        `output-${actualTotalDuration.toFixed(1)}s.mp4`
      );

      console.log(`Attempting to render video to: ${outputFile}`);
      console.log(`Total frames to render: ${frameList.length}`);
      console.log(`Actual total duration: ${actualTotalDuration.toFixed(2)}s`);

      // Ensure the output file path doesn't exist yet
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }

      // Render the video
      if (frameList.length === 0) {
        throw new Error("No frames prepared for video rendering");
      }

      // Final check of the frame list before rendering
      console.log("Frame list preparation complete. Ready to render video.");
      frameList.forEach((frame, index) => {
        if (!fs.existsSync(frame.filePath)) {
          console.warn(
            `WARNING: Frame ${index} file does not exist: ${frame.filePath}`
          );
        } else {
          const stats = fs.statSync(frame.filePath);
          if (stats.size === 0) {
            console.warn(
              `WARNING: Frame ${index} file is empty: ${frame.filePath}`
            );
          } else {
            console.log(
              `Frame ${index}: ${frame.filePath} (${stats.size} bytes, ${frame.duration}s)`
            );
          }
        }
      });

      // Now render the final video
      await ffmpegRenderer.renderVideo(
        frameList,
        outputFile,
        dimensions,
        qualitySettings
      );

      console.log(`Video rendering complete: ${outputFile}`);
      return outputFile;
    } catch (error) {
      console.error("Error rendering video:", error);
      // Try to clean up any incomplete output files in the temp directory
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          const files = fs.readdirSync(tempDir);
          for (const file of files) {
            if (file.endsWith(".mp4") && file.includes("-incomplete")) {
              const filePath = path.join(tempDir, file);
              fs.unlinkSync(filePath);
            }
          }
        } catch (cleanupError) {
          console.error("Error during cleanup:", cleanupError);
        }
      }

      throw new Error(
        `Failed to render video: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get video dimensions from format string
   */
  private getDimensionsFromFormat(format: string): {
    width: number;
    height: number;
  } {
    // Use centralized dimension configuration
    const { getDimensionsFromFormat } = require("@/app/utils/video-dimensions");
    return getDimensionsFromFormat(format);
  }

  /**
   * Get quality settings based on selected quality
   */
  private getQualitySettings(quality: string): {
    bitrate: string;
    fps: number;
  } {
    switch (quality) {
      case "high":
        return { bitrate: "12M", fps: 30 };
      case "medium":
        return { bitrate: "6M", fps: 30 };
      case "low":
        return { bitrate: "3M", fps: 24 };
      default:
        return { bitrate: "6M", fps: 30 };
    }
  }
}

// Create and export a singleton instance
export const videoService = new VideoService();
