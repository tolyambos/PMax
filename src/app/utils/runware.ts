import { z } from "zod";
import { RunwareServer } from "@runware/sdk-js";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";

// Define schemas using Zod for type validation
const RunwareImageOptionsSchema = z.object({
  prompt: z.string().min(1).max(1950),
  negativePrompt: z.string().optional().default(""),
  width: z.number().min(128).max(2048).multipleOf(64).default(1024),
  height: z.number().min(128).max(2048).multipleOf(64).default(1024),
  numSamples: z.number().min(1).max(4).default(1),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().default("9:16"),
});

const RunwareVideoOptionsSchema = z.object({
  prompt: z.string().min(1).max(1950),
  negativePrompt: z.string().optional().default(""),
  duration: z.number().min(1).max(20).default(4),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().default("9:16"),
});

// Type definitions
type RunwareImageOptions = z.infer<typeof RunwareImageOptionsSchema>;
type RunwareVideoOptions = z.infer<typeof RunwareVideoOptionsSchema>;

// Default negative prompt with quality improvements
const DEFAULT_NEGATIVE_PROMPT =
  "low quality, bad quality, blurry, distorted, deformed, text, watermark, signature, logo, pixelated, grainy, noise";

/**
 * Runware service client for image and video generation
 */
export class RunwareService {
  private apiKey: string;
  private runwareServer: RunwareServer | null = null;
  private mockMode: boolean;

  constructor() {
    this.apiKey = process.env.RUNWARE_API_KEY || "";
    this.mockMode = process.env.NODE_ENV === "development" && !this.apiKey;

    if (this.apiKey) {
      try {
        this.runwareServer = new RunwareServer({ apiKey: this.apiKey });
      } catch (error) {
        console.error("Failed to initialize Runware SDK:", error);
        this.mockMode = true;
      }
    }
  }

  /**
   * Generate an image from a text prompt
   * @param options Image generation options
   * @returns Image data with URL
   */
  async generateImage(options: RunwareImageOptions) {
    try {
      // Validate input with Zod
      const validatedOptions = RunwareImageOptionsSchema.parse(options);
      const {
        prompt,
        negativePrompt = DEFAULT_NEGATIVE_PROMPT,
        width: requestedWidth,
        height: requestedHeight,
        numSamples,
        format,
      } = validatedOptions;

      // Determine dimensions based on format (if both width and height aren't explicitly set)
      let width = requestedWidth;
      let height = requestedHeight;

      if (format && requestedWidth === 1024 && requestedHeight === 1024) {
        if (format === "9:16") {
          width = 1024;
          height = 1792;
        } else if (format === "16:9") {
          width = 1792;
          height = 1024;
        } else if (format === "1:1") {
          width = 1024;
          height = 1024;
        } else if (format === "4:5") {
          width = 1024;
          height = 1280;
        }
      }

      const taskUUID = this.generateUUID();

      // If in mock mode or development with API issues, return mock data
      if (this.mockMode) {
        console.log("Using mock data for Runware API (no API key or dev mode)");
        return this.createMockResponse(taskUUID, width, height);
      }

      if (!this.runwareServer) {
        throw new Error("Runware SDK not initialized");
      }

      try {
        // Request image generation
        const result = await this.runwareServer.requestImages({
          customTaskUUID: taskUUID,
          model: "runware:101@1", // General purpose model
          positivePrompt: prompt,
          negativePrompt,
          width,
          height,
          numberResults: numSamples,
          outputType: "URL",
          outputFormat: "JPG",
          includeCost: true,
        });

        // Handle result
        if (!result || result.length === 0) {
          throw new Error("No image generated");
        }

        // Return first image result
        return {
          taskType: "imageInference",
          taskUUID,
          imageUUID: result[0].imageUUID,
          imageURL: result[0].imageURL,
          cost: result[0].cost,
        };
      } catch (apiError) {
        console.error("Runware API Error:", apiError);

        // Fall back to mock data in development
        if (process.env.NODE_ENV === "development") {
          console.log("Falling back to mock data after API error");
          return this.createMockResponse(taskUUID, width, height);
        }

        throw apiError;
      }
    } catch (validationError: unknown) {
      console.error("Validation error:", validationError);
      const errorMessage =
        validationError instanceof Error
          ? validationError.message
          : "Unknown validation error";
      throw new Error(`Invalid options: ${errorMessage}`);
    }
  }

  /**
   * Generate a video from a text prompt (placeholder implementation)
   * @param options Video generation options
   * @returns Video data with URL
   */
  async generateVideo(options: RunwareVideoOptions) {
    try {
      // Validate input with Zod
      const validatedOptions = RunwareVideoOptionsSchema.parse(options);
      const {
        prompt,
        negativePrompt = DEFAULT_NEGATIVE_PROMPT,
        duration,
        format = "9:16",
      } = validatedOptions;

      // For video, we'll use their image generation for now
      // In the actual implementation with full Runware video API, this would be different

      // Use centralized dimensions to ensure consistency with video export
      const {
        getDimensionsFromFormat,
      } = require("@/app/utils/video-dimensions");
      const dimensions = getDimensionsFromFormat(format);
      const width = dimensions.width;
      const height = dimensions.height;

      try {
        const result = await this.generateImage({
          prompt: `Video scene: ${prompt}`,
          negativePrompt,
          width,
          height,
          format,
          numSamples: 1,
        });

        return {
          ...result,
          duration,
          videoURL: result.imageURL, // In reality, this would be a video URL
        };
      } catch (error) {
        console.error("Runware Video API Error:", error);
        throw error;
      }
    } catch (validationError: unknown) {
      console.error("Validation error:", validationError);
      const errorMessage =
        validationError instanceof Error
          ? validationError.message
          : "Unknown validation error";
      throw new Error(`Invalid options: ${errorMessage}`);
    }
  }

  /**
   * Download an image from a URL to a local file
   * @param url The URL to download from
   * @param filePath The local file path to save to
   */
  async downloadImage(url: string, filePath: string) {
    if (!url) {
      throw new Error("No URL provided for image download");
    }

    console.log(`Downloading image from URL: ${url}`);

    // Use the generic download method
    return this.downloadFile(url, filePath, "image");
  }

  /**
   * Download a video from a URL to a local file
   * @param url The URL to download from
   * @param filePath The local file path to save to
   */
  async downloadVideo(url: string, filePath: string) {
    if (!url) {
      throw new Error("No URL provided for video download");
    }

    console.log(`Downloading video from URL: ${url}`);

    // Use the generic download method
    return this.downloadFile(url, filePath, "video");
  }

  /**
   * Download a video file specifically for the export process
   * This handles common issues with animation URLs containing query parameters
   * @param url The video URL to download from
   * @param filePath The local file path to save to
   */
  async downloadVideoFile(url: string, filePath: string) {
    if (!url) {
      throw new Error("No URL provided for video file download");
    }

    console.log(`Downloading video file from URL: ${url}`);

    try {
      // Handle relative URLs by converting them to absolute URLs
      let videoUrl = url;
      if (videoUrl.startsWith("/")) {
        // This is a relative URL, convert it to absolute using the server's base URL
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        videoUrl = `${baseUrl}${videoUrl}`;
        console.log(`Converting relative URL to absolute: ${videoUrl}`);
      }

      // Try to download the video from the URL
      await this.downloadFile(videoUrl, filePath, "video file");
      return;
    } catch (downloadError) {
      console.error("Error downloading video file:", downloadError);

      // If download fails and it's a relative URL, try to find it locally
      if (url.startsWith("/")) {
        const localFilePath = path.join(
          process.cwd(),
          "public",
          url.replace(/^\//, "")
        );

        if (fs.existsSync(localFilePath)) {
          console.log(`Found local video file at ${localFilePath}`);
          await fs.promises.copyFile(localFilePath, filePath);
          console.log(`Copied local video file to ${filePath}`);
          return;
        }
      }

      // If we reach here, both remote and local attempts failed
      throw downloadError;
    }
  }

  /**
   * Generic method to download a file from a URL
   * @param url The URL to download from
   * @param filePath The local file path to save to
   * @param fileType Type of file being downloaded (for logging)
   */
  private async downloadFile(url: string, filePath: string, fileType: string) {
    // Check and fix the URL before attempting to download
    if (!url) {
      throw new Error(`Cannot download ${fileType}: URL is missing or empty`);
    }

    // Ensure URL starts with http:// or https://
    let validUrl = url.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      console.warn(
        `URL missing protocol: "${validUrl}". Adding https:// prefix.`
      );
      validUrl = `https://${validUrl}`;
    }

    // Ensure directory exists
    const directory = path.dirname(filePath);
    await fs.promises.mkdir(directory, { recursive: true });

    const retryCount = 3;
    const retryDelay = 2000;
    let lastError: Error | null = null;

    // Try multiple times with delay between attempts
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `Retry attempt ${attempt + 1}/${retryCount} for downloading ${fileType}`
          );
        }

        const response = await fetch(validUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to download ${fileType}: ${response.statusText}`
          );
        }

        const buffer = await response.buffer();
        await fs.promises.writeFile(filePath, buffer);

        console.log(`Successfully downloaded ${fileType} to ${filePath}`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Download attempt ${attempt + 1} failed:`, error);

        // If we have more retries left, wait before trying again
        if (attempt < retryCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If we get here, all attempts failed
    throw new Error(
      lastError?.message ||
        `Failed to download ${fileType} after multiple attempts`
    );
  }

  /**
   * Generate a mock response for testing
   * @param taskUUID The task UUID
   * @param width Image width
   * @param height Image height
   * @returns Mock response data
   */
  private createMockResponse(taskUUID: string, width: number, height: number) {
    const imageId = Math.floor(Math.random() * 1000);
    return {
      taskType: "imageInference",
      taskUUID: taskUUID,
      imageUUID: `00000000-0000-4000-a000-${taskUUID.substring(0, 12)}`,
      imageURL: `https://picsum.photos/seed/${imageId}/${width}/${height}`,
      cost: 0.0,
    };
  }

  /**
   * Generate a UUID v4
   * @returns UUID string
   */
  private generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

export const runwareService = new RunwareService();
