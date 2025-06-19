"use client";

import { useRef, useState } from "react";
import { useToast } from "@/app/components/ui/use-toast";
import Image from "next/image";
import { S3AssetMemoized } from "@/components/S3Asset";
import { Asset } from "@/app/components/assets/asset-library";
import { useEditor } from "./context/editor-context";
import { useSceneManagement } from "./hooks/use-scene-management";
import { useVideoFormat } from "@/app/contexts/format-context";
import AIPromptModal from "./ai-prompt-modal";
import { PlusCircle, Wand2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

// We keep the props type similar to the original for backward compatibility
// but make all props optional since we'll use context
type TimelineProps = {
  scenes?: any[];
  selectedSceneId?: string | null;
  onSelectScene?: (sceneId: string) => void;
  onAddScene?: () => void;
  onAddAssetToScene?: (sceneId: string, asset: Asset) => void;
  onDeleteScene?: (sceneId: string) => void;
  onReorderScenes?: (scenes: any[]) => void;
};

export default function Timeline(
  {
    // Props are maintained for backward compatibility
    // but we'll primarily use the context system
  }: TimelineProps
) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Use the editor context for scene data
  const { state, dispatch } = useEditor();
  const { scenes, selectedSceneId } = state;
  const { formatDetails } = useVideoFormat();

  // Use the scene management hook for scene operations
  const { addEmptyScene, getTotalDuration, selectScene } = useSceneManagement();

  // AI Modal state for regeneration
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(
    null
  );
  const [aiPromptType, setAIPromptType] = useState<"scene" | "background">(
    "scene"
  );

  // Calculate total duration
  const totalDuration = getTotalDuration();

  // Calculate dynamic width for scenes based on duration - horizontal rectangles
  const calculateSceneWidth = (duration: number) => {
    const minWidth = 80; // Minimum width for horizontal rectangle
    const maxWidth = 160; // Maximum width for longer scenes
    const baseWidthPerSecond = 20; // 20px per second

    const calculatedWidth = Math.max(
      minWidth,
      Math.min(maxWidth, duration * baseWidthPerSecond)
    );
    return calculatedWidth;
  };

  const handleSceneClick = (sceneId: string) => {
    selectScene(sceneId);
  };

  // Handle AI generation results
  const handleAIGenerate = (result: any) => {
    if (!regeneratingSceneId) return;

    if (Array.isArray(result) && result.length > 0) {
      if (regeneratingSceneId === "new-scene") {
        // Add new scenes
        const newScenes = result.map((scene, index) => ({
          id: `ai-scene-${Date.now()}-${index}`,
          order: scenes.length + index,
          duration: Math.min(scene.duration || 3, 5), // Ensure max duration is 5 seconds
          imageUrl: scene.imageUrl,
          prompt: scene.prompt,
          elements: [],
          animationStatus: "none",
          animationPrompt: "",
        }));

        // Add the scenes
        newScenes.forEach((scene) => {
          dispatch({
            type: "ADD_SCENE",
            payload: scene,
          });
        });

        toast({
          title: "Scenes Added",
          description: `Added ${newScenes.length} new AI-generated scenes to your project.`,
        });
      } else {
        // Regenerate existing scene
        const newScene = result[0]; // Take the first generated scene

        // Update the scene with new content
        const updates = {
          imageUrl: newScene.imageUrl,
          prompt: newScene.prompt,
          // Reset animation status since we have a new image
          animationStatus: "none",
          animationPrompt: "",
          videoUrl: undefined,
        };

        // Update the scene directly
        dispatch({
          type: "UPDATE_SCENE",
          payload: {
            sceneId: regeneratingSceneId,
            updates,
          },
        });

        toast({
          title: "Scene Regenerated",
          description: "Scene has been regenerated with new AI content",
        });
      }
    }

    setRegeneratingSceneId(null);
  };

  // Handle dragging a scene (for reordering)
  const handleSceneDragStart = (e: React.DragEvent, scene: any) => {
    // Set data for scene reordering
    e.dataTransfer.setData(
      "application/scene",
      JSON.stringify({
        id: scene.id,
        type: "scene",
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle dropping a scene (for reordering)
  const handleSceneDrop = (e: React.DragEvent, targetSceneId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Try to get scene data (for reordering)
    const sceneData = e.dataTransfer.getData("application/scene");

    if (sceneData) {
      try {
        // This is a scene being reordered
        const { id: sourceSceneId } = JSON.parse(sceneData);

        if (sourceSceneId === targetSceneId) return; // Same scene, no action needed

        // Find indices
        const sourceIndex = scenes.findIndex((s) => s.id === sourceSceneId);
        const targetIndex = scenes.findIndex((s) => s.id === targetSceneId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        // Create a new array of scenes with the source scene moved to target position
        const newScenes = [...scenes];
        const [movedScene] = newScenes.splice(sourceIndex, 1);
        newScenes.splice(targetIndex, 0, movedScene);

        // Update order properties
        const reorderedScenes = newScenes.map((scene, index) => ({
          ...scene,
          order: index,
        }));

        // Update scene order via context
        dispatch({ type: "REORDER_SCENES", payload: reorderedScenes });

        toast({
          title: "Scenes reordered",
          description: "The scene order has been updated",
        });

        return;
      } catch (error) {
        console.error("Error reordering scenes:", error);
      }
    }

    // Handle asset drops
    handleAssetDrop(e, targetSceneId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    // Check if this is a scene being dragged (for reordering)
    if (e.dataTransfer.types.includes("application/scene")) {
      e.dataTransfer.dropEffect = "move";
    } else {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  // Handle dropping an asset onto a scene
  const handleAssetDrop = (e: React.DragEvent, sceneId: string) => {
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      const asset = JSON.parse(data) as Asset;

      // Create a new element
      const newElement = {
        id: `element-${uuidv4()}`,
        type: determineAssetType(asset.url),
        assetId: asset.id,
        url: asset.url,
        x: 20,
        y: 20,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1.0,
        zIndex: 10, // Put on top
      };

      // Add the element to the scene using context
      dispatch({
        type: "ADD_ELEMENT",
        payload: {
          sceneId,
          element: newElement,
        },
      });

      toast({
        title: "Asset added to scene",
        description: `Added ${asset.name} to the scene`,
      });
    } catch (error) {
      console.error("Error adding asset to timeline:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add asset to timeline",
      });
    }
  };

  // Helper function to determine element type from asset URL
  const determineAssetType = (url: string): "image" | "audio" | "video" => {
    // Determine type based on file extension
    if (url.match(/\.(jpeg|jpg|png|gif|webp|svg)$/i)) {
      return "image";
    } else if (url.match(/\.(mp3|wav|ogg|aac)$/i)) {
      return "audio";
    } else {
      return "video"; // Default to video for other formats like mp4, webm, etc.
    }
  };

  // Fixed height for a clean, consistent timeline look
  const timelineHeight = "h-16 sm:h-18 md:h-20";

  return (
    <div
      className={`flex flex-col p-2 mb-4 border-t backdrop-blur-sm sm:p-3 bg-background/95 ${timelineHeight}`}
      ref={timelineRef}
    >
      <div className="flex justify-between items-center mb-1 sm:mb-2">
        <div className="text-xs font-medium sm:text-sm">Timeline</div>
        <div className="text-xs text-muted-foreground">{totalDuration}s</div>
      </div>

      {/* Timeline scroll container with indicators */}
      <div className="relative flex-1">
        <div className="flex overflow-x-auto flex-1 gap-1 sm:gap-2 scroll-smooth scrollbar-thin">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className={`group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-md border ${selectedSceneId === scene.id ? "ring-2 ring-primary" : ""}`}
              style={{
                width: `${calculateSceneWidth(scene.duration)}px`,
                height: "48px", // Fixed height for horizontal rectangles (3rem = 48px)
              }}
              onClick={() => handleSceneClick(scene.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleSceneDrop(e, scene.id)}
              draggable={true}
              onDragStart={(e) => handleSceneDragStart(e, scene)}
            >
              {/* Highlight the drop zone when dragging over */}
              <div
                className="absolute inset-0 z-10 opacity-0 transition-opacity bg-primary/20"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.opacity = "1";
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.opacity = "0";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.opacity = "0";
                  handleSceneDrop(e, scene.id);
                }}
              >
                <div className="flex justify-center items-center h-full">
                  <div className="p-2 text-xs font-medium rounded-md bg-background">
                    Drop to add to scene
                  </div>
                </div>
              </div>

              {scene.imageUrl ? (
                <div className="overflow-hidden relative w-full h-full">
                  <S3AssetMemoized
                    url={scene.imageUrl}
                    alt={`Scene ${scene.order + 1}`}
                    width={200}
                    height={120}
                    className="object-cover w-full h-full"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center w-full h-full bg-card text-muted-foreground">
                  <span className="text-xs">Scene {scene.order + 1}</span>
                </div>
              )}

              <div className="absolute right-0 bottom-0 left-0 px-1 sm:px-2 py-0.5 sm:py-1 text-xs text-center text-white bg-black/70">
                {scene.duration}s
              </div>

              {/* Show indicator for elements in the scene */}
              {scene.elements && scene.elements.length > 0 && (
                <div className="flex absolute top-1 sm:top-2 left-0.5 sm:left-1 justify-center items-center w-4 h-4 sm:w-5 sm:h-5 text-xs rounded-full bg-primary text-primary-foreground">
                  {scene.elements.length}
                </div>
              )}
            </div>
          ))}

          {/* Add Scene Buttons */}
          <div className="flex flex-shrink-0 gap-1 sm:gap-2">
            {/* AI Generate Scene Button */}
            <button
              className="flex flex-col justify-center items-center w-16 h-full bg-gradient-to-b from-blue-50 to-blue-100 rounded-md border border-dashed transition-colors sm:w-20 md:w-24 text-muted-foreground hover:border-primary hover:text-primary hover:from-blue-100 hover:to-blue-200 touch-manipulation"
              onClick={() => {
                setRegeneratingSceneId("new-scene");
                setAIPromptType("scene");
                setIsAIModalOpen(true);
              }}
              title="Generate new scenes with AI"
            >
              <Wand2 className="mb-0.5 sm:mb-1 w-3 sm:w-4 md:w-5 h-3 sm:h-4 md:h-5" />
              <span className="hidden text-xs font-medium sm:inline">
                AI Scene
              </span>
              <span className="text-xs font-medium sm:hidden">AI</span>
            </button>

            {/* Empty Scene Button */}
            <button
              className="flex flex-col justify-center items-center w-14 h-full rounded-md border border-dashed transition-colors sm:w-16 md:w-20 text-muted-foreground hover:border-primary hover:text-primary touch-manipulation"
              onClick={addEmptyScene}
              title="Add empty scene"
            >
              <PlusCircle className="mb-0.5 sm:mb-1 w-3 sm:w-4 md:w-5 h-3 sm:h-4 md:h-5" />
              <span className="hidden text-xs font-medium sm:inline">
                Empty
              </span>
              <span className="text-xs font-medium sm:hidden">+</span>
            </button>
          </div>
        </div>

        {/* Scroll indicators */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none opacity-0 transition-opacity [.scrollbar-thin:has(>div:not(:first-child)):hover>&]:opacity-100" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none opacity-0 transition-opacity [.scrollbar-thin:has(>div:not(:last-child)):hover>&]:opacity-100" />
      </div>

      {/* AI Prompt Modal for regeneration */}
      {regeneratingSceneId && (
        <AIPromptModal
          isOpen={isAIModalOpen}
          onClose={() => {
            setIsAIModalOpen(false);
            setRegeneratingSceneId(null);
          }}
          onGenerate={handleAIGenerate}
          type={aiPromptType}
          forCurrentScene={regeneratingSceneId !== "new-scene"}
          isRegenerating={regeneratingSceneId !== "new-scene"}
          existingPrompt={
            regeneratingSceneId !== "new-scene"
              ? scenes.find((s) => s.id === regeneratingSceneId)?.prompt || ""
              : ""
          }
        />
      )}
    </div>
  );
}
