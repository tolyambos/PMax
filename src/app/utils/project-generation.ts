// Utility for handling long-running project generation with timeout protection

export interface ProjectGenerationOptions {
  timeoutMs?: number;
  onProgress?: (message: string) => void;
  onTimeout?: () => void;
}

export class ProjectGenerationManager {
  private timeoutId: NodeJS.Timeout | null = null;

  async generateProject(
    projectData: any,
    options: ProjectGenerationOptions = {}
  ): Promise<any> {
    const {
      timeoutMs = 60000, // 60 seconds default
      onProgress,
      onTimeout,
    } = options;

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
