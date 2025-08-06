import { AnimationProvider } from "@/app/contexts/settings-context";

export interface AnimationOptions {
  imageUrl: string;
  prompt: string;
  provider: AnimationProvider;
  // Runway-specific options
  runwayModel?: string;
  // Bytedance-specific options
  resolution?: "480p" | "720p" | "1080p";
  duration?: "5" | "10";
  cameraFixed?: boolean;
  seed?: number;
  endImageUrl?: string;
}

export interface AnimationResult {
  videoUrl: string;
  provider: AnimationProvider;
  cost?: number;
  metadata?: {
    seed?: number;
    duration?: string;
    resolution?: string;
    [key: string]: any;
  };
}

export class UnifiedAnimationService {
  async generateAnimation(options: AnimationOptions): Promise<AnimationResult> {
    console.log("[UnifiedAnimation] 🎬 Starting animation generation");
    console.log("[UnifiedAnimation] Provider:", options.provider);
    console.log("[UnifiedAnimation] Options:", {
      imageUrl: options.imageUrl.substring(0, 100) + "...",
      prompt: options.prompt.substring(0, 100) + "...",
      provider: options.provider,
    });

    if (options.provider === "bytedance") {
      return this.generateWithBytedance(options);
    } else if (options.provider === "runway") {
      return this.generateWithRunway(options);
    } else {
      throw new Error(`Unsupported animation provider: ${options.provider}`);
    }
  }

  private async generateWithBytedance(
    options: AnimationOptions
  ): Promise<AnimationResult> {
    console.log("[UnifiedAnimation] 🚀 Using Bytedance Seedance");

    // If running server-side, use the service directly
    if (typeof window === 'undefined') {
      console.log("[UnifiedAnimation] Running server-side, using bytedanceAnimationService directly");
      
      // Import the service dynamically to avoid client-side issues
      const { bytedanceAnimationService } = await import("@/app/utils/bytedance-animation");
      const { s3Utils } = await import("@/lib/s3-utils");
      
      // Generate presigned URL if needed
      let publicImageUrl = options.imageUrl;
      let publicEndImageUrl = options.endImageUrl;
      
      const isS3Url = (url: string) => 
        url && (url.includes("wasabisys.com") || 
                url.includes("amazonaws.com") || 
                url.includes("s3."));
      
      if (isS3Url(options.imageUrl)) {
        console.log("[UnifiedAnimation] Generating presigned URL for S3 image");
        const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(options.imageUrl);
        publicImageUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
      }
      
      // Also generate presigned URL for end image if provided
      if (options.endImageUrl && isS3Url(options.endImageUrl)) {
        console.log("[UnifiedAnimation] Generating presigned URL for S3 end image");
        const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(options.endImageUrl);
        publicEndImageUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
      }
      
      const result = await bytedanceAnimationService.generateAnimation({
        imageUrl: publicImageUrl,
        prompt: options.prompt,
        resolution: options.resolution || "1080p",
        duration: options.duration || "5",
        cameraFixed: options.cameraFixed || false,
        seed: options.seed,
        endImageUrl: publicEndImageUrl,
      });
      
      return {
        videoUrl: result.videoUrl,
        provider: "bytedance",
        cost: result.cost,
        metadata: {
          seed: result.seed,
          duration: options.duration || "5",
          resolution: options.resolution || "1080p",
        },
      };
    }

    // Client-side: use the API endpoint
    const url = `${window.location.origin}/api/animation/bytedance`;
      
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: options.imageUrl,
        prompt: options.prompt,
        resolution: options.resolution || "1080p",
        duration: options.duration || "5",
        cameraFixed: options.cameraFixed || false,
        seed: options.seed,
        endImageUrl: options.endImageUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.details || `Bytedance API error: ${response.status}`
      );
    }

    const result = await response.json();

    return {
      videoUrl: result.data.videoUrl,
      provider: "bytedance",
      cost: result.data.cost,
      metadata: {
        seed: result.data.seed,
        duration: options.duration || "5",
        resolution: options.resolution || "1080p",
      },
    };
  }

  private async generateWithRunway(
    options: AnimationOptions
  ): Promise<AnimationResult> {
    console.log("[UnifiedAnimation] 🎭 Using Runway Gen-4");

    // If running server-side, use the service directly
    if (typeof window === 'undefined') {
      console.log("[UnifiedAnimation] Running server-side, using videoAnimationService directly");
      
      // Import the service dynamically to avoid client-side issues
      const { videoAnimationService } = await import("@/app/utils/video-animation");
      
      // Generate animation
      const animationPath = await videoAnimationService.generateAnimation({
        imageUrl: options.imageUrl,
        imagePrompt: options.prompt,
        duration: Number(options.duration) || 5,
        format: "mp4",
        width: 1920,
        height: 1080,
        fps: 30,
      });
      
      // Since this returns a local path, we need to upload it to S3
      const { s3Utils } = await import("@/lib/s3-utils");
      const fs = await import("fs");
      
      // Read the file
      const videoBuffer = await fs.promises.readFile(animationPath);
      
      // Upload to S3
      const bucket = process.env.S3_BUCKET_NAME || "pmax-images";
      const key = `video/animations/animation_${Date.now()}.mp4`;
      
      await s3Utils.uploadBufferToS3(
        bucket,
        key,
        videoBuffer,
        "video/mp4"
      );
      
      const s3Url = s3Utils.generateS3Url(bucket, key);
      
      // Clean up temp file
      await fs.promises.unlink(animationPath).catch(() => {});
      
      return {
        videoUrl: s3Url,
        provider: "runway",
        metadata: {
          duration: options.duration || "5",
        },
      };
    }

    // Client-side: use the API endpoint
    const url = `${window.location.origin}/api/animation/generate`;
      
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: options.imageUrl,
        prompt: options.prompt,
        model: options.runwayModel || "gen4",
        // Pass duration if provided (Runway accepts 0.1-60 seconds, default 5)
        ...(options.duration && { duration: parseFloat(options.duration) }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.details || `Runway API error: ${response.status}`
      );
    }

    const result = await response.json();

    return {
      videoUrl: result.data.videoUrl || result.videoUrl,
      provider: "runway",
      cost: result.data.cost || result.cost,
      metadata: {
        model: options.runwayModel || "gen4",
        taskId: result.data.taskId || result.taskId,
      },
    };
  }

  /**
   * Get provider capabilities and status
   */
  async getProviderStatus() {
    const providers = {
      bytedance: {
        available: true,
        name: "Bytedance Seedance",
        description: "Fast, high-quality AI video generation",
        features: ["5-10 second videos", "1080p resolution", "Camera control"],
        recommended: true,
      },
      runway: {
        available: true,
        name: "Runway Gen-4",
        description: "Professional-grade video generation",
        features: ["Cinematic quality", "Advanced controls", "Multiple models"],
        recommended: false,
      },
    };

    // Check if services are actually available by testing endpoints
    try {
      const bytedanceUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/animation/bytedance`
        : "/api/animation/bytedance";
      const bytedanceTest = await fetch(bytedanceUrl, {
        method: "GET",
      });
      providers.bytedance.available = bytedanceTest.ok;
    } catch (error) {
      console.warn("[UnifiedAnimation] Bytedance service check failed:", error);
      providers.bytedance.available = false;
    }

    try {
      const runwayUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/animation/generate`
        : "/api/animation/generate";
      const runwayTest = await fetch(runwayUrl, {
        method: "GET",
      });
      providers.runway.available = runwayTest.ok;
    } catch (error) {
      console.warn("[UnifiedAnimation] Runway service check failed:", error);
      providers.runway.available = false;
    }

    return providers;
  }
}

export const unifiedAnimationService = new UnifiedAnimationService();
