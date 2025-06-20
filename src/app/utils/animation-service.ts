import { AnimationProvider } from "@/app/contexts/settings-context";

export interface AnimationOptions {
  imageUrl: string;
  prompt: string;
  provider: AnimationProvider;
  // Runway-specific options
  runwayModel?: string;
  // Bytedance-specific options
  resolution?: "480p" | "720p";
  duration?: "5" | "10";
  cameraFixed?: boolean;
  seed?: number;
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

    // Construct proper URL for client-side requests
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/animation/bytedance`
      : "/api/animation/bytedance";
      
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: options.imageUrl,
        prompt: options.prompt,
        resolution: options.resolution || "720p",
        duration: options.duration || "5",
        cameraFixed: options.cameraFixed || false,
        seed: options.seed,
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
        resolution: options.resolution || "720p",
      },
    };
  }

  private async generateWithRunway(
    options: AnimationOptions
  ): Promise<AnimationResult> {
    console.log("[UnifiedAnimation] 🎭 Using Runway Gen-4");

    // Construct proper URL for client-side requests
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/animation/generate`
      : "/api/animation/generate";
      
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: options.imageUrl,
        prompt: options.prompt,
        model: options.runwayModel || "gen4",
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
        features: ["5-10 second videos", "720p resolution", "Camera control"],
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
