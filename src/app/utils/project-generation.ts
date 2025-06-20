// Utility for handling long-running project generation with timeout protection

export interface ProjectGenerationOptions {
  timeoutMs?: number;
  onProgress?: (message: string) => void;
  onTimeout?: () => void;
}

export class ProjectGenerationManager {
  private timeoutId: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  async generateProject(
    projectData: any,
    options: ProjectGenerationOptions = {}
  ): Promise<any> {
    const {
      timeoutMs = 600000, // 10 minutes default
      onProgress,
      onTimeout,
    } = options;

    // Check if we're in production (client-side detection)
    const isProduction =
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

    if (isProduction) {
      return this.generateProjectBackground(projectData, options);
    } else {
      return this.generateProjectDirect(projectData, options);
    }
  }

  private async generateProjectDirect(
    projectData: any,
    options: ProjectGenerationOptions = {}
  ): Promise<any> {
    const { timeoutMs = 90000, onProgress, onTimeout } = options;

    // Set up timeout
    let timedOut = false;
    this.timeoutId = setTimeout(() => {
      timedOut = true;
      onTimeout?.();
    }, timeoutMs);

    try {
      onProgress?.("Starting project generation...");

      const response = await fetch("/api/ai/generate-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(projectData),
      });

      // Clear timeout if request completes
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (timedOut) {
        throw new Error(
          "Request timed out - project may still be generating in background"
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      onProgress?.("Project generation completed!");

      return result;
    } catch (error) {
      // Clear timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // If it's a network error or timeout, suggest checking status
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Connection lost during generation. The project may still be creating in the background. " +
            "Please check your projects in a few minutes."
        );
      }

      throw error;
    }
  }

  private async generateProjectBackground(
    projectData: any,
    options: ProjectGenerationOptions = {}
  ): Promise<any> {
    const { onProgress, onTimeout } = options;

    try {
      onProgress?.("Starting background project generation...");

      // Start background job
      const response = await fetch("/api/ai/generate-project/background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server error: ${response.status}`);
      }

      const { jobId } = await response.json();
      onProgress?.("Project generation started in background...");

      // Poll for completion
      return new Promise((resolve, reject) => {
        let pollCount = 0;
        const maxPolls = 120; // 10 minutes max (5 second intervals)

        this.pollingInterval = setInterval(async () => {
          try {
            pollCount++;
            onProgress?.(
              `Generating project... (${Math.min(pollCount * 5, 95)}% estimated)`
            );

            const statusResponse = await fetch(
              `/api/ai/generate-project/background?jobId=${jobId}`
            );

            if (!statusResponse.ok) {
              throw new Error("Failed to check job status");
            }

            const status = await statusResponse.json();

            if (status.status === "completed") {
              if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
              }
              onProgress?.("Project generation completed!");
              resolve(status.result);
            } else if (status.status === "failed") {
              if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
              }
              reject(new Error(status.error || "Background job failed"));
            } else if (pollCount >= maxPolls) {
              if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
              }
              onTimeout?.();
              reject(
                new Error(
                  "Background job timed out - project may still be generating"
                )
              );
            }
          } catch (error) {
            if (this.pollingInterval) {
              clearInterval(this.pollingInterval);
              this.pollingInterval = null;
            }
            reject(error);
          }
        }, 5000); // Poll every 5 seconds
      });
    } catch (error) {
      throw error;
    }
  }

  async checkProjectStatus(): Promise<any> {
    try {
      const response = await fetch("/api/ai/generate-project/status");

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to check project status:", error);
      throw error;
    }
  }

  cleanup() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

// Helper function for use in components
export function createProjectWithTimeout(
  projectData: any,
  onProgress: (message: string) => void,
  onTimeout: () => void
): Promise<any> {
  const manager = new ProjectGenerationManager();

  return manager
    .generateProject(projectData, {
      timeoutMs: 90000, // 90 seconds
      onProgress,
      onTimeout,
    })
    .finally(() => {
      manager.cleanup();
    });
}
