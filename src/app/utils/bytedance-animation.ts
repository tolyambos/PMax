import { fal } from "@fal-ai/client";

// Initialize FAL client with API key
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

export interface BytedanceAnimationOptions {
  imageUrl: string;
  prompt: string;
  resolution?: "480p" | "720p";
  duration?: "5" | "10";
  cameraFixed?: boolean;
  seed?: number;
}

export interface BytedanceAnimationResult {
  videoUrl: string;
  seed: number;
  cost?: number;
}

export class BytedanceAnimationService {
  private mockMode: boolean;

  constructor() {
    this.mockMode =
      process.env.NODE_ENV === "development" && !process.env.FAL_KEY;
  }

  async generateAnimation(
    options: BytedanceAnimationOptions
  ): Promise<BytedanceAnimationResult> {
    console.log("[BytedanceAnimation] 🎬 Starting animation generation");
    console.log("[BytedanceAnimation] Options:", {
      imageUrl: options.imageUrl.substring(0, 100) + "...",
      prompt: options.prompt,
      resolution: options.resolution || "720p",
      duration: parseInt(options.duration || "5"), // Show converted duration
      cameraFixed: options.cameraFixed || false,
      seed: options.seed || -1,
    });

    if (this.mockMode) {
      console.log("[BytedanceAnimation] Using mock mode (no FAL_KEY)");
      return this.createMockResponse();
    }

    try {
      const result = await fal.subscribe(
        "fal-ai/bytedance/seedance/v1/lite/image-to-video",
        {
          input: {
            prompt: options.prompt,
            image_url: options.imageUrl,
            resolution: options.resolution || "720p",
            duration: parseInt(options.duration || "5"), // Convert to number
            camera_fixed: options.cameraFixed || false,
            seed: options.seed || -1, // -1 for random
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              console.log(
                "[BytedanceAnimation] Progress:",
                update.logs?.map((log) => log.message).join(", ")
              );
            } else {
              console.log("[BytedanceAnimation] Queue status:", update.status);
            }
          },
        }
      );

      console.log("[BytedanceAnimation] ✅ Animation generated successfully");
      console.log("[BytedanceAnimation] Result:", {
        videoUrl: result.data.video?.url?.substring(0, 100) + "...",
        seed: result.data.seed,
      });

      return {
        videoUrl: result.data.video.url,
        seed: result.data.seed,
      };
    } catch (error) {
      console.error(
        "[BytedanceAnimation] ❌ Error generating animation:",
        error
      );

      // Log detailed error information for debugging
      if (error && typeof error === "object") {
        console.error("[BytedanceAnimation] Error details:", {
          status: (error as any).status,
          statusText: (error as any).statusText,
          body: (error as any).body,
          message: (error as any).message,
        });

        // If there's a body with detail, log it
        if ((error as any).body && (error as any).body.detail) {
          console.error(
            "[BytedanceAnimation] Validation errors:",
            (error as any).body.detail
          );
        }
      }

      // Provide helpful error messages
      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = (error as any).message;

        if (errorMessage.includes("rate limit")) {
          throw new Error(
            "Rate limit exceeded. Please try again in a few minutes."
          );
        }

        if (errorMessage.includes("insufficient credits")) {
          throw new Error("Insufficient credits for animation generation.");
        }

        if (errorMessage.includes("invalid image")) {
          throw new Error(
            "Invalid image format or URL. Please ensure the image is accessible."
          );
        }
      }

      throw new Error(
        `Animation generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private createMockResponse(): BytedanceAnimationResult {
    const mockVideoId = Math.floor(Math.random() * 1000);
    return {
      videoUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
      seed: Math.floor(Math.random() * 1000000),
    };
  }

  /**
   * Check if the service is available (has API key)
   */
  isAvailable(): boolean {
    return !this.mockMode;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      mockMode: this.mockMode,
      hasApiKey: !!process.env.FAL_KEY,
    };
  }
}

export const bytedanceAnimationService = new BytedanceAnimationService();
