import { z } from "zod";
import { RunwareServer } from "@runware/sdk-js";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";

// Define schemas using Zod for type validation
const RunwayImageOptionsSchema = z.object({
  prompt: z.string().min(1).max(1950),
  negativePrompt: z.string().optional().default(""),
  width: z.number().min(128).max(2048).multipleOf(64).default(1024),
  height: z.number().min(128).max(2048).multipleOf(64).default(1024),
  numSamples: z.number().min(1).max(4).default(1),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().default("9:16"),
});

const RunwayVideoOptionsSchema = z.object({
  prompt: z.string().min(1).max(1950),
  negativePrompt: z.string().optional().default(""),
  duration: z.number().min(1).max(20).default(4),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().default("9:16"),
});

// Type definitions
type RunwayImageOptions = z.infer<typeof RunwayImageOptionsSchema>;
type RunwayVideoOptions = z.infer<typeof RunwayVideoOptionsSchema>;

// Default negative prompt with quality improvements
const DEFAULT_NEGATIVE_PROMPT =
  "low quality, bad quality, blurry, distorted, deformed, text, watermark, signature, logo, pixelated, grainy, noise";

/**
 * Runware (formerly RunwayML) service client for image and video generation
 */
export class RunwayMLService {
  private apiKey: string;
  private runwareServer: RunwareServer | null = null;
  private mockMode: boolean;

  constructor() {
    this.apiKey = process.env.RUNWAYML_API_KEY || "";
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
  async generateImage(options: RunwayImageOptions) {
    try {
      // Validate input with Zod
      const validatedOptions = RunwayImageOptionsSchema.parse(options);
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
  async generateVideo(options: RunwayVideoOptions) {
    try {
      // Validate input with Zod
      const validatedOptions = RunwayVideoOptionsSchema.parse(options);
      const {
        prompt,
        negativePrompt = DEFAULT_NEGATIVE_PROMPT,
        duration,
        format = "9:16",
      } = validatedOptions;

      // For video, we'll use their image generation for now
      // In the actual implementation with full Runway video API, this would be different

      // Use dimensions based on format for the video
      let width = 1024;
      let height = 1792;

      if (format === "16:9") {
        width = 1792;
        height = 1024;
      } else if (format === "1:1") {
        width = 1024;
        height = 1024;
      } else if (format === "4:5") {
        width = 1024;
        height = 1280;
      }

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
            `Retry attempt ${attempt + 1}/${retryCount} for downloading image`
          );
        }

        const response = await fetch(url as string);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const buffer = await response.buffer();
        await fs.promises.writeFile(filePath, buffer);

        console.log(`Successfully downloaded image to ${filePath}`);
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
      lastError?.message || "Failed to download image after multiple attempts"
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

export const runwayMLService = new RunwayMLService();
