/**
 * Client-side video service that communicates with server API endpoints
 * instead of using Node.js modules directly
 */
export class ClientVideoService {
  /**
   * Render a video by calling the server-side API
   */
  public async renderVideo(options: any): Promise<string> {
    try {
      console.log("Sending video render request to server API");

      // Call the server API endpoint instead of processing directly
      const response = await fetch("/api/video/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Video render API returned status: ${response.status}`);
      }

      const data = await response.json();
      return data.outputPath;
    } catch (error: any) {
      console.error("Error in client video service:", error);
      throw new Error(
        `Failed to render video: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get video dimensions from format string
   */
  public getDimensionsFromFormat(format: string): {
    width: number;
    height: number;
  } {
    // Use centralized dimension configuration
    const { getDimensionsFromFormat } = require("@/app/utils/video-dimensions");
    return getDimensionsFromFormat(format);
  }
}

// Create and export a singleton instance
export const clientVideoService = new ClientVideoService();
