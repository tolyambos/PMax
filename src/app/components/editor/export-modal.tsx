import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { useVideoFormat } from "@/app/contexts/format-context";
import { useEditor } from "./context/editor-context";
import { clientVideoService } from "@/app/utils/video/client-video-service";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  projectId,
}: ExportModalProps) {
  // Use editor context to directly access scene data
  const { state } = useEditor();

  // Use format context to get current video format
  const { currentFormat, formatDetails } = useVideoFormat();

  // Local state
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Get available scenes directly from editor context (live data)
  const availableScenes = state.scenes.filter(
    (scene) =>
      scene &&
      (scene.imageUrl || scene.videoUrl || scene.backgroundColor) &&
      scene.duration
  );

  // Debug logging to see what the export modal is seeing
  useEffect(() => {
    if (isOpen) {
      console.log(
        "[Export Modal] Current scenes state:",
        state.scenes.map((scene, index) => ({
          index: index + 1,
          id: scene.id,
          useAnimatedVersion: scene.useAnimatedVersion,
          hasVideoUrl: !!scene.videoUrl,
          animationStatus: scene.animationStatus,
        }))
      );
    }
  }, [isOpen, state.scenes]);

  // Force re-render when any scene's useAnimatedVersion changes
  useEffect(() => {
    if (isOpen) {
      console.log(
        "[Export Modal] Scene animation states changed, re-rendering..."
      );
    }
  }, [isOpen, ...state.scenes.map((s) => s.useAnimatedVersion)]);

  const handleExport = async () => {
    // Set global flag to prevent storage cleanup during export
    if (typeof window !== "undefined") {
      window.__EXPORT_IN_PROGRESS = true;
      console.log("Set __EXPORT_IN_PROGRESS flag to prevent storage cleanup");
    }

    setIsExporting(true);

    try {
      // Get scenes directly from our context - this ensures we have the latest state
      const scenes = state.scenes;
      console.log(`Starting export with ${scenes.length} scenes from context`);

      // Sort scenes by order property to ensure correct sequence
      const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
      console.log(
        `Sorted scenes by order: ${sortedScenes.map((s) => `${s.id}(order:${s.order})`).join(", ")}`
      );

      // Check for valid scenes with required properties
      let validScenes = sortedScenes.filter((scene) => {
        const hasBackground =
          scene && (scene.imageUrl || scene.videoUrl || scene.backgroundColor);
        const hasDuration = scene && scene.duration;
        const isValid = hasBackground && hasDuration;
        if (!isValid) {
          console.warn(`Scene missing required data:`, {
            sceneId: scene?.id,
            hasImageUrl: !!scene?.imageUrl,
            hasVideoUrl: !!scene?.videoUrl,
            hasBackgroundColor: !!scene?.backgroundColor,
            hasDuration: !!scene?.duration,
            scene: scene,
          });
        }
        return isValid;
      });

      if (validScenes.length === 0) {
        throw new Error(
          "No valid scenes with images and durations found for export"
        );
      }

      console.log(
        `Found ${validScenes.length} valid scenes for export out of ${scenes.length} total`
      );

      // Use scene panel settings to determine animation usage
      validScenes = validScenes.map((scene, index) => {
        // Check if user chose to use animated version in scene panel
        const useAnimatedVersion = scene.useAnimatedVersion;
        const hasVideoUrl = !!scene.videoUrl;

        console.log(`[Export] Scene ${index + 1} (${scene.id}) settings:`, {
          useAnimatedVersion,
          hasVideoUrl,
          animationStatus: scene.animationStatus,
        });

        if (
          useAnimatedVersion &&
          hasVideoUrl &&
          scene.animationStatus !== "none"
        ) {
          // Use the existing animation as chosen in scene panel
          console.log(`[Export] Scene ${index + 1}: Using animated version`);
          return {
            ...scene,
            animate: true,
            videoUrl: scene.videoUrl,
          };
        } else if (useAnimatedVersion && !hasVideoUrl) {
          // User wants animation but none exists - request new animation
          console.log(
            `[Export] Scene ${index + 1}: Will request new animation`
          );
          return {
            ...scene,
            animate: true,
            imagePrompt:
              scene.imagePrompt || scene.prompt || `Scene ${scene.id}`,
          };
        }

        // Use static image as chosen in scene panel
        console.log(`[Export] Scene ${index + 1}: Using static version`);
        return {
          ...scene,
          animate: false,
        };
      });

      console.log(`Prepared ${validScenes.length} scenes for video export`);

      // Create export payload
      const exportPayload = {
        projectId,
        scenes: validScenes.map((scene) => ({
          ...scene,
          renderElementsServerSide: true,
        })),
        format: currentFormat,
        quality,
      };

      // Log the payload preview
      console.log("Export payload (preview):", {
        projectId: exportPayload.projectId,
        sceneCount: exportPayload.scenes.length,
        format: exportPayload.format,
        quality: exportPayload.quality,
      });

      // Use the new videoService to render the video
      const outputPath = await clientVideoService.renderVideo(exportPayload);

      // Download the video file
      const response = await fetch(
        `/api/download?path=${encodeURIComponent(outputPath)}`
      );

      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }

      // Get the video blob
      const videoBlob = await response.blob();

      // Create a download link
      const downloadUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${projectId}-${currentFormat}.mp4`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, 100);

      toast({
        title: "Export complete",
        description: "Your video has been exported successfully.",
      });
    } catch (error: unknown) {
      console.error("Export error:", error);

      // Extract error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during export.";

      toast({
        variant: "destructive",
        title: "Export failed",
        description: errorMessage,
      });
    } finally {
      // Clear export flag
      if (typeof window !== "undefined") {
        window.__EXPORT_IN_PROGRESS = false;
      }

      setIsExporting(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Video Format</h3>
            <div className="flex items-center px-4 py-2 rounded-md bg-muted">
              <div className="flex-1">
                <div className="font-medium">{formatDetails.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDetails.width} × {formatDetails.height} pixels
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The video will be exported using the format selected in the
              editor. To change the format, close this dialog and use the format
              selector in the editor.
            </p>
          </div>

          {/* Quality Selection */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Video Quality</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={quality === "low" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuality("low")}
              >
                Low
              </Button>
              <Button
                variant={quality === "medium" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuality("medium")}
              >
                Medium
              </Button>
              <Button
                variant={quality === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuality("high")}
              >
                High
              </Button>
            </div>
          </div>

          {/* Scene Preview */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Scenes to Export</h3>
            <div className="p-3 rounded-md border bg-muted/30">
              <p className="mb-2 text-xs text-muted-foreground">
                Export will use the display mode (static or animated) chosen for
                each scene in the Scene Panel.
              </p>
              <div className="overflow-y-auto space-y-2 max-h-40">
                {availableScenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    className="flex justify-between items-center"
                  >
                    <div className="flex items-center">
                      <div className="ml-2 text-sm">
                        Scene {index + 1}
                        {scene.prompt
                          ? ` - ${scene.prompt.substring(0, 30)}...`
                          : ""}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {scene.useAnimatedVersion && scene.videoUrl
                        ? "Animated"
                        : "Static"}
                      {/* Debug info */}
                      <div className="text-xs opacity-50">
                        (useAnim: {scene.useAnimatedVersion ? "✓" : "✗"},
                        hasVideo: {scene.videoUrl ? "✓" : "✗"})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export Video"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
