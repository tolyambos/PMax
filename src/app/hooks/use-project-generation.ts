import { useState, useCallback } from "react";
import { ProjectGenerationManager } from "@/app/utils/project-generation";

export interface UseProjectGenerationReturn {
  isGenerating: boolean;
  progress: string;
  error: string | null;
  timedOut: boolean;
  generateProject: (projectData: any) => Promise<any>;
  checkStatus: () => Promise<any>;
  reset: () => void;
}

export function useProjectGeneration(): UseProjectGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const generateProject = useCallback(async (projectData: any) => {
    setIsGenerating(true);
    setError(null);
    setTimedOut(false);
    setProgress("Preparing project generation...");

    const manager = new ProjectGenerationManager();

    try {
      const result = await manager.generateProject(projectData, {
        timeoutMs: 120000, // 2 minutes
        onProgress: (message) => {
          setProgress(message);
        },
        onTimeout: () => {
          setTimedOut(true);
          setProgress(
            "Generation is taking longer than expected. Checking if project was created..."
          );
        },
      });

      setProgress("Project generated successfully!");
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);

      // If it's a timeout/connection error, suggest checking status
      if (errorMessage.includes("fetch") || errorMessage.includes("timeout")) {
        setTimedOut(true);
        setProgress(
          'Connection lost. The project may still be generating. Use "Check Status" to see if it completed.'
        );
      }

      throw err;
    } finally {
      setIsGenerating(false);
      manager.cleanup();
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setProgress("Checking project status...");

    try {
      const manager = new ProjectGenerationManager();
      const status = await manager.checkProjectStatus();

      if (status.status === "completed") {
        setProgress(`Project "${status.project.name}" found! Redirecting...`);
        setTimedOut(false);
        return status.project;
      } else if (status.status === "partial") {
        setProgress(
          `Project "${status.project.name}" is still generating (${status.project.completedScenes}/${status.project.sceneCount} scenes complete)`
        );
        return status.project;
      } else {
        setProgress(
          "No completed project found yet. Please wait a bit longer and try again."
        );
        return null;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check status";
      setError(errorMessage);
      setProgress("");
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress("");
    setError(null);
    setTimedOut(false);
  }, []);

  return {
    isGenerating,
    progress,
    error,
    timedOut,
    generateProject,
    checkStatus,
    reset,
  };
}
