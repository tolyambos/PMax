import { z } from "zod";
import OpenAI from "openai";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";
import { VIDEO_PROMPT_GENERATION } from "./prompts";
import RunwayML from "@runwayml/sdk";
import { exec } from "child_process";
import { promisify } from "util";

// Dynamically import ffmpeg-static to handle cases where it's not available
let ffmpegStatic: string | null = null;
try {
  // This will work in development but may fail in production Docker
  ffmpegStatic = require("ffmpeg-static");
  console.log("Using ffmpeg-static:", ffmpegStatic);
} catch (error) {
  console.log("ffmpeg-static not available, will use system ffmpeg");
}

// Function to get ffmpeg path
function getFFmpegPath(): string {
  // First try ffmpeg-static
  if (ffmpegStatic && typeof ffmpegStatic === "string") {
    return ffmpegStatic;
  }

  // Fallback to system ffmpeg (useful in Docker)
  return "ffmpeg";
}

// Test ffmpeg availability
async function testFFmpegAvailability(): Promise<boolean> {
  try {
    const execAsync = promisify(exec);
    const ffmpegPath = getFFmpegPath();
    await execAsync(`${ffmpegPath} -version`);
    console.log("FFmpeg is available at:", ffmpegPath);
    return true;
  } catch (error) {
    console.error("FFmpeg is not available:", error);
    return false;
  }
}

// Interface for task response based on actual API
interface TaskResponse {
  id: string;
  status:
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "PENDING"
    | "CANCELLED"
    | "THROTTLED";
  createdAt: string;
  output?: string[];
  failure?: string;
  failureCode?: string;
  progress?: number;
}

/**
 * Schemas for animation generation
 */
const AnimationOptionsSchema = z.object({
  imageUrl: z.string().url(),
  imagePrompt: z.string().optional(),
  width: z.number().min(512).max(1024).default(512),
  height: z.number().min(512).max(1024).default(512),
  duration: z.number().min(1).max(60).default(5), // Default to 5 seconds for animations
  fps: z.number().min(24).max(60).default(24),
  format: z.enum(["mp4", "gif"]).default("mp4"),
});

type AnimationOptions = z.infer<typeof AnimationOptionsSchema>;

/**
 * Service for generating animated content from images using Runway
 */
export class VideoAnimationService {
  private apiKey: string;
  private openai: OpenAI | null = null;
  private runwayClient: RunwayML | null = null;
  private lastAnimationUrl: string | null = null;
  private lastProcessedPrompt: string | null = null;

  constructor() {
    // Get Runway API key - should be in RUNWAYML_API_SECRET as per docs
    this.apiKey =
      process.env.RUNWAYML_API_SECRET || process.env.RUNWAYML_API_KEY || "";

    // Set up OpenAI client if available
    const openaiApiKey = process.env.OPENAI_API_KEY || "";
    if (openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
      });
    }

    // Initialize Runway SDK
    try {
      if (this.apiKey) {
        console.log(
          "Initializing Runway SDK with API key:",
          this.apiKey.substring(0, 5) + "..."
        );

        // Create Runway client according to documentation
        this.runwayClient = new RunwayML();

        console.log("Runway SDK client initialized successfully");
      } else {
        console.warn(
          "No Runway API key found. Animation features will be mocked."
        );
      }
    } catch (error) {
      console.error("Failed to initialize Runway SDK:", error);
      this.runwayClient = null;
    }
  }

  /**
   * Generate an animation from a static image
   * @param options Animation generation options
   * @returns Path to the generated animation file
   */
  async generateAnimation(options: AnimationOptions): Promise<string> {
    try {
      // Validate the options
      const validatedOptions = AnimationOptionsSchema.parse(options);

      // Create a temporary directory for processing
      const tempDir = path.join(os.tmpdir(), `pmax-animation-${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download the source image
      const imagePath = path.join(tempDir, "source.jpg");
      await this.downloadImage(validatedOptions.imageUrl, imagePath);

      // Determine the actual image dimensions and aspect ratio
      let imageFormat: "landscape" | "portrait" | "square" | "wide" | "tall" =
        "landscape";
      let imageAspectRatio = 1;

      try {
        // Use sharp to get the image dimensions (most reliable)
        try {
          const sharp = await import("sharp");
          const metadata = await sharp.default(imagePath).metadata();
          if (metadata.width && metadata.height) {
            // Calculate aspect ratio
            imageAspectRatio = metadata.width / metadata.height;

            // Determine format based on aspect ratio
            if (Math.abs(imageAspectRatio - 1) < 0.05) {
              // Near square
              imageFormat = "square";
            } else if (imageAspectRatio > 2.2) {
              // Very wide format (like 2.35:1 cinematic)
              imageFormat = "wide";
            } else if (imageAspectRatio > 1) {
              // Standard landscape
              imageFormat = "landscape";
            } else if (imageAspectRatio < 0.5) {
              // Very tall format
              imageFormat = "tall";
            } else {
              // Standard portrait
              imageFormat = "portrait";
            }

            console.log(
              "Detected image dimensions with Sharp:",
              metadata.width,
              "x",
              metadata.height
            );
            console.log(
              `Calculated aspect ratio: ${imageAspectRatio.toFixed(2)} (${imageFormat} format)`
            );
          } else {
            throw new Error("Could not get image dimensions with Sharp");
          }
        } catch (sharpError) {
          console.warn(
            "Error using sharp to get dimensions, falling back to alternate methods:",
            sharpError
          );

          // Use the image dimensions provided by the API
          const width = validatedOptions.width;
          const height = validatedOptions.height;

          // Calculate aspect ratio from provided dimensions
          imageAspectRatio = width / height;

          // Determine format based on aspect ratio
          if (Math.abs(imageAspectRatio - 1) < 0.05) {
            imageFormat = "square";
          } else if (imageAspectRatio > 2.2) {
            imageFormat = "wide";
          } else if (imageAspectRatio > 1) {
            imageFormat = "landscape";
          } else if (imageAspectRatio < 0.5) {
            imageFormat = "tall";
          } else {
            imageFormat = "portrait";
          }

          console.log("Using provided dimensions:", width, "x", height);
          console.log(
            `Calculated aspect ratio: ${imageAspectRatio.toFixed(2)} (${imageFormat} format)`
          );
        }
      } catch (error) {
        console.warn(
          "Error detecting image dimensions, using default landscape format:",
          error
        );
        imageFormat = "landscape";
        imageAspectRatio = 16 / 9;
      }

      // Generate a video prompt using GPT if we have OpenAI API access
      let videoPrompt = "";
      if (validatedOptions.imagePrompt) {
        // Check if this looks like a user-generated animation prompt (contains motion keywords)
        // vs an image description that needs to be transformed
        const motionKeywords = [
          "camera",
          "zoom",
          "pan",
          "move",
          "motion",
          "animate",
          "sway",
          "flow",
          "drift",
          "rotate",
          "cinematic",
          "parallax",
          "gentle",
          "slow",
          "fast",
          "subtle",
          "dramatic",
          "smooth",
          "static",
          "locked",
        ];

        const hasMotionKeywords = motionKeywords.some((keyword) =>
          validatedOptions.imagePrompt?.toLowerCase().includes(keyword)
        );

        if (hasMotionKeywords) {
          // This looks like a user-generated animation prompt, use it directly
          videoPrompt = validatedOptions.imagePrompt;
          console.log(
            "Using user-provided animation prompt directly:",
            videoPrompt
          );
        } else if (this.openai) {
          // This looks like an image description, transform it with GPT
          videoPrompt = await this.generateVideoPrompt(
            validatedOptions.imagePrompt
          );
          console.log(
            "Generated video prompt from image description:",
            videoPrompt
          );
        } else {
          // No OpenAI available, use the prompt as-is
          videoPrompt = validatedOptions.imagePrompt;
          console.log(
            "Using provided prompt directly (no OpenAI):",
            videoPrompt
          );
        }
      } else {
        // Default generic motion prompt if no prompt is provided
        videoPrompt =
          "The subject gently moves. Slight breeze affects elements in the scene. Slow zoom in. Cinematic live-action.";
        console.log("Using default video prompt:", videoPrompt);
      }

      // Set FORCE_REAL_ANIMATION to true to use the actual Runway API in development
      if (process.env.NODE_ENV === "development") {
        process.env.FORCE_REAL_ANIMATION = "true";
      }

      // Store the final processed prompt for later retrieval
      this.lastProcessedPrompt = videoPrompt;

      // Generate the animation using Runway SDK, passing the correct format
      const animationPath = await this.runwayAnimate(
        imagePath,
        videoPrompt,
        tempDir,
        validatedOptions.duration,
        imageFormat
      );

      return animationPath;
    } catch (error: unknown) {
      console.error("Error generating animation:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to generate animation: ${errorMessage}`);
    }
  }

  /**
   * Generate a video prompt from an image prompt using GPT
   * @param imagePrompt The original image prompt
   * @returns A video generation prompt
   */
  private async generateVideoPrompt(imagePrompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      const prompt = VIDEO_PROMPT_GENERATION.replace(
        "{imagePrompt}",
        imagePrompt
      );

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a helpful video motion expert." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const videoPrompt = response.choices[0]?.message?.content?.trim() || "";
      return videoPrompt;
    } catch (error) {
      console.error("Error generating video prompt:", error);
      // Fallback to a generic video prompt
      return "The scene has subtle movement. Elements gently animate. Locked camera. Cinematic live-action.";
    }
  }

  /**
   * Call Runway API to generate an animation using the official SDK
   * @param imagePath Path to the source image
   * @param prompt The animation prompt
   * @param outputDir Output directory
   * @param duration Duration in seconds
   * @param imageFormat The detected image format (landscape, portrait, square, wide, tall)
   * @returns Path to the generated animation
   */
  private async runwayAnimate(
    imagePath: string,
    prompt: string,
    outputDir: string,
    duration: number = 3,
    imageFormat:
      | "landscape"
      | "portrait"
      | "square"
      | "wide"
      | "tall" = "landscape"
  ): Promise<string> {
    // If no client is available, return a mock video path
    if (!this.runwayClient) {
      console.log("No Runway client available, using mock animation");
      return this.mockAnimation(imagePath, outputDir);
    }

    try {
      console.log(
        `Animating image with prompt: "${prompt.substring(0, 50)}..."`
      );

      // Create a unique ID for this animation
      const uniqueId = Date.now().toString();

      // For testing in dev environment, but override if specifically asked to animate
      if (
        process.env.NODE_ENV === "development" &&
        !process.env.FORCE_REAL_ANIMATION
      ) {
        console.log(
          "DEV MODE: Would normally use mock animation, but forcing real animation"
        );
        console.log("I WANT TO ANIMATE WITH RUNWAY!!!!");
        // DO NOT use mock, continue with real animation
      }

      // Convert image to data URL if not already a URL
      let imageUrl = imagePath;
      if (!imagePath.startsWith("http")) {
        // Read the image file as a buffer and convert to base64
        const imageBuffer = await fs.promises.readFile(imagePath);
        const base64String = imageBuffer.toString("base64");
        const mimeType = `image/${path.extname(imagePath).slice(1) || "jpeg"}`;
        imageUrl = `data:${mimeType};base64,${base64String}`;
        console.log(
          `Converted local image to data URL: ${mimeType}, size: ${imageBuffer.length} bytes`
        );
      } else {
        console.log(`Using remote image URL: ${imageUrl.substring(0, 100)}...`);

        // If this is an S3 URL, we need to get a fresh presigned URL for Runway
        if (
          imageUrl.includes("s3.eu-central-1.wasabisys.com") ||
          imageUrl.includes("wasabisys.com") ||
          imageUrl.includes("amazonaws.com")
        ) {
          try {
            const { s3Utils } = await import("@/lib/s3-utils");

            // Extract bucket and key from the URL
            const { bucket, bucketKey } =
              s3Utils.extractBucketAndKeyFromUrl(imageUrl);
            const freshPresignedUrl = await s3Utils.getPresignedUrl(
              bucket,
              bucketKey
            );

            // Use the fresh presigned URL for Runway API
            imageUrl = freshPresignedUrl;
            console.log(`Generated fresh presigned URL for Runway API`);
          } catch (error) {
            console.error(
              "Failed to generate fresh presigned URL for Runway:",
              error
            );
            // Continue with original URL as fallback
          }
        }

        // Validate that the URL is accessible
        try {
          const response = await fetch(imageUrl, { method: "HEAD" });
          if (!response.ok) {
            console.warn(
              `Image URL validation failed: ${response.status} ${response.statusText}`
            );
            console.warn(`This might cause Runway API to fail`);
          } else {
            console.log(`Image URL validation successful: ${response.status}`);
          }
        } catch (urlError) {
          console.warn(
            `Unable to validate image URL:`,
            (urlError as Error).message
          );
          console.warn(`This might cause Runway API to fail`);
        }
      }

      console.log("Creating image-to-video task using Runway SDK...");

      // Determine the correct ratio based on format
      // For Gen-4 Turbo, options are: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, or 1584:672
      let ratio: string;

      switch (imageFormat) {
        case "square":
          ratio = "960:960"; // Square 1:1 format
          break;
        case "landscape":
          ratio = "1280:720"; // Standard landscape 16:9
          break;
        case "portrait":
          ratio = "720:1280"; // Standard portrait 9:16
          break;
        case "tall":
          ratio = "832:1104"; // Taller aspect ratio 3:4
          break;
        case "wide":
          ratio = "1584:672"; // Extra wide format ~2.35:1
          break;
        default:
          ratio = "1280:720"; // Default to landscape 16:9
      }

      // Log the ratio decision with details
      console.log("------------------------------------");
      console.log(`IMAGE FORMAT: ${imageFormat.toUpperCase()}`);
      console.log(`ANIMATION RATIO: ${ratio}`);
      console.log(`ANIMATION DURATION: 5 SECONDS`);
      console.log(`RUNWAY GEN-4 TURBO OUTPUT FORMAT: ${ratio}`);
      console.log(`PROMPT TEXT: "${prompt.slice(0, 100)}..."`);
      console.log(
        `IMAGE URL TYPE: ${imageUrl.startsWith("data:") ? "data-url" : "http-url"}`
      );
      console.log("------------------------------------");

      const requestParams = {
        model: "gen4_turbo" as any, // Type assertion to bypass SDK type issues
        promptImage: imageUrl,
        promptText: prompt.slice(0, 900), // Truncate to be safe
        ratio: ratio as any, // Type assertion for outdated type definitions
        duration: 5 as 5, // Force 5-second duration for all animations
      };

      console.log("Creating Runway task with parameters:", {
        model: requestParams.model,
        promptText: requestParams.promptText,
        ratio: requestParams.ratio,
        duration: requestParams.duration,
        imageUrlLength: imageUrl.length,
        imageUrlPrefix: imageUrl.substring(0, 50) + "...",
      });

      // Create a new image-to-video task using the SDK with minimal required parameters
      let imageToVideo;
      try {
        imageToVideo =
          await this.runwayClient.imageToVideo.create(requestParams);
        console.log(
          "Runway task created successfully with ID:",
          imageToVideo.id
        );
      } catch (createError) {
        console.error("Error creating Runway task:", createError);
        console.error("Request parameters were:", requestParams);
        throw new Error(
          `Failed to create Runway task: ${(createError as Error).message || createError}`
        );
      }

      if (!imageToVideo.id) {
        throw new Error("No task ID in Runway API response");
      }

      // Poll for task completion
      let animationUrl = null;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let attempts = 0;

      console.log(`Polling for task ${imageToVideo.id} completion...`);

      while (true) {
        // Wait before polling again (5 seconds as recommended in docs)
        await new Promise((resolve) => setTimeout(resolve, 5000));

        attempts++;

        // Check task status
        const taskStatus = (await this.runwayClient.tasks.retrieve(
          imageToVideo.id
        )) as TaskResponse;
        console.log(
          `Task status: ${taskStatus.status}`,
          taskStatus.progress ? `Progress: ${taskStatus.progress}` : ""
        );

        if (
          taskStatus.status === "SUCCEEDED" &&
          taskStatus.output &&
          taskStatus.output.length > 0
        ) {
          animationUrl = taskStatus.output[0]; // Get the first video URL
          console.log("Animation succeeded! Output URL:", animationUrl);
          this.lastAnimationUrl = animationUrl; // Store the last animation URL
          break;
        } else if (taskStatus.status === "FAILED") {
          const error = taskStatus.failure || "Unknown error";
          const failureCode = taskStatus.failureCode || "NO_CODE";

          console.error("Runway task failed with details:", {
            status: taskStatus.status,
            failure: taskStatus.failure,
            failureCode: taskStatus.failureCode,
            fullTaskResponse: taskStatus,
          });

          throw new Error(
            `Animation task failed: ${error} (Code: ${failureCode})`
          );
        } else if (taskStatus.status === "CANCELLED") {
          throw new Error("Animation task was canceled");
        } else if (taskStatus.status === "THROTTLED") {
          throw new Error("Animation task was throttled due to rate limiting");
        }

        if (attempts >= maxAttempts) {
          throw new Error("Animation task timed out after 5 minutes");
        }
      }

      if (!animationUrl) {
        throw new Error("No animation URL in successful response");
      }

      try {
        // Download the generated video
        const outputPath = path.join(outputDir, `animation-${uniqueId}.mp4`);
        console.log(
          `Downloading video from ${animationUrl} to ${outputPath}...`
        );
        const response = await fetch(animationUrl);
        if (!response.ok) {
          throw new Error(`Failed to download video: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.promises.writeFile(outputPath, buffer);
        console.log("Video downloaded successfully");

        return outputPath;
      } catch (downloadError) {
        console.error("Error downloading video:", downloadError);
        return this.mockAnimation(imagePath, outputDir);
      }
    } catch (error) {
      console.error("Error calling Runway API:", error);
      // Fall back to mock video if in development
      if (process.env.NODE_ENV === "development") {
        console.log("Falling back to mock animation");
        return this.mockAnimation(imagePath, outputDir);
      }
      throw error;
    }
  }

  /**
   * Create a mock animation for development/testing
   * @param imagePath Source image path
   * @param outputDir Output directory
   * @returns Path to the mock animation
   */
  private async mockAnimation(
    imagePath: string,
    outputDir: string
  ): Promise<string> {
    console.log("Generating mock animation");

    try {
      // For a better mock, we'll create a simple animation by copying the image
      // to a video file using ffmpeg
      const outputPath = path.join(
        outputDir,
        `mock-animation-${Date.now()}.mp4`
      );

      // Check if we have ffmpeg available
      if (await testFFmpegAvailability()) {
        const execAsync = promisify(exec);
        const ffmpegPath = getFFmpegPath();

        console.log("Creating mock animation using ffmpeg");
        console.log("FFmpeg path:", ffmpegPath);

        // Create a 3-second video from the still image
        const duration = 3;
        // Don't quote the ffmpeg path - let the shell handle it properly
        const command = `${ffmpegPath} -loop 1 -i "${imagePath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`;

        try {
          await execAsync(command);
          console.log("Mock animation created successfully");
          return outputPath;
        } catch (execError) {
          console.error("Error executing ffmpeg command:", execError);
          console.log("Falling back to minimal MP4 method");
        }
      } else {
        console.warn("FFmpeg not available for mock animation, using fallback");
      }

      // Fallback: create a minimal valid MP4 file
      console.log("Using minimal MP4 as fallback mock");
      const mockVideoBase64 =
        "AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tAAAAH21vb3YAAABsbXZoZAAAAADaAE8D2gBPAwAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIYdHJhawAAAFx0a2hkAAAAB9oATwPaAE8DAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAACgAAAAWgAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABANoATwMAAAAAAAEAAAAAAbWbWRpYQAAACBtZGhkAAAAANoATwPaAE8DAAAAAAAAAAAAAAAAAAAA////SAAAAg1wcm90b19wbGF5ZXJfbWluaW1hbC5qcw0NCgA=";
      const videoBuffer = Buffer.from(mockVideoBase64, "base64");
      await fs.promises.writeFile(outputPath, videoBuffer);

      return outputPath;
    } catch (error) {
      console.error("Error creating mock animation:", error);

      // Ultimate fallback - just return the image path
      // In a real app, we'd convert it properly, but this works for demo purposes
      return imagePath;
    }
  }

  /**
   * Download image from a URL
   * @param url Image URL
   * @param outputPath Output path
   */
  private async downloadImage(url: string, outputPath: string): Promise<void> {
    console.log(`Downloading image from ${url.substring(0, 100)}...`);

    let downloadUrl = url;

    // If this is an S3 URL, generate a presigned URL for downloading
    if (
      url.includes("s3.eu-central-1.wasabisys.com") ||
      url.includes("wasabisys.com") ||
      url.includes("amazonaws.com")
    ) {
      try {
        const { s3Utils } = await import("@/lib/s3-utils");

        // Extract bucket and key from the URL
        const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(url);
        downloadUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
        console.log(`Generated fresh presigned URL for download`);
      } catch (error) {
        console.error(
          "Failed to generate presigned URL, trying direct download:",
          error
        );
        // Continue with original URL as fallback
      }
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${response.statusText} from ${downloadUrl.substring(0, 100)}...`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(outputPath, buffer);

    console.log(`Image saved to ${outputPath}, size: ${buffer.length} bytes`);
  }

  /**
   * Download video from a URL
   * @param url Video URL
   * @param outputPath Output path
   */
  private async downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log(`Downloading video from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(outputPath, buffer);

    console.log(`Video saved to ${outputPath}`);
  }

  /**
   * Get the last animation URL
   * @returns The last animation URL or null if not available
   */
  public getLastAnimationUrl(): string | null {
    return this.lastAnimationUrl;
  }

  /**
   * Get the last processed prompt that was sent to Runway
   * @returns The last processed prompt or null if not available
   */
  public getLastProcessedPrompt(): string | null {
    return this.lastProcessedPrompt;
  }
}

export const videoAnimationService = new VideoAnimationService();
