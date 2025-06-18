"use client";

import { useRef, useEffect, useState } from "react";
import { CSSProperties } from "react";
import Image from "next/image";
import { S3AssetMemoized } from "@/components/S3Asset";
import { useEditor } from "./context/editor-context";
import { useElementManipulation } from "./hooks/use-element-manipulation";
import { useImprovedElementSelection } from "./hooks/use-improved-element-selection"; // Import from separate file
import { useSceneManagement } from "./hooks/use-scene-management";
import { useVideoFormat } from "@/app/contexts/format-context";
import { ElementRenderer } from "./element-renderer";
import { Button } from "@/app/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Fullscreen,
  Layers,
  Play,
  Grid,
  LucideHelpCircle,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

export default function SceneCanvas() {
  const { state, dispatch } = useEditor();
  const { scenes, selectedSceneId } = state;
  const { formatDetails } = useVideoFormat();
  const { selectScene, getTotalDuration } = useSceneManagement();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<"normal" | "fullscreen">(
    "normal"
  );

  // Get the element manipulation functions for dragging, resizing, and rotating
  const { handleDragStart, handleResizeStart, handleRotateStart } =
    useElementManipulation({ canvasRef });

  // Get the improved element selection functions from dedicated hook
  const { handleElementClick, handleCanvasClick } =
    useImprovedElementSelection();

  // Find the current scene based on selected ID
  const selectedSceneIndex = selectedSceneId
    ? scenes.findIndex((scene) => scene.id === selectedSceneId)
    : 0;

  // Set the current scene index based on the selected scene
  useEffect(() => {
    if (selectedSceneIndex >= 0) {
      setCurrentSceneIndex(selectedSceneIndex);
    }
  }, [selectedSceneIndex]);

  // Get the current scene
  const currentScene = scenes[currentSceneIndex] || null;

  // Calculate canvas dimensions
  const videoWidth = formatDetails.width;
  const videoHeight = formatDetails.height;

  // Calculate a zoom scale to fit the canvas on screen while maintaining aspect ratio
  const MAX_CONTAINER_HEIGHT = 600;
  // Safely access window for client-side rendering
  const FULLSCREEN_HEIGHT =
    typeof window !== "undefined" ? window.innerHeight * 0.85 : 800; // Use 85% of viewport height for fullscreen

  // Adjust the zoom scale based on preview mode
  const zoomScale =
    previewMode === "fullscreen"
      ? FULLSCREEN_HEIGHT / videoHeight
      : MAX_CONTAINER_HEIGHT / videoHeight;

  // Define the canvas dimensions using zoom scale
  const canvasWidth = videoWidth * zoomScale;
  const canvasHeight = videoHeight * zoomScale;

  // Container style with zoom handling - apply fullscreen styles when in fullscreen mode
  const containerStyle: CSSProperties = {
    width: `${canvasWidth}px`,
    height: `${canvasHeight}px`,
    overflow: "hidden",
    position:
      previewMode === "fullscreen" ? ("fixed" as const) : ("relative" as const),
    top: previewMode === "fullscreen" ? "50%" : "auto",
    left: previewMode === "fullscreen" ? "50%" : "auto",
    transform: previewMode === "fullscreen" ? "translate(-50%, -50%)" : "none",
    margin: previewMode === "fullscreen" ? "0" : "0 auto",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    boxShadow:
      previewMode === "fullscreen"
        ? "none"
        : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    zIndex: previewMode === "fullscreen" ? 50 : 1,
    transition: "all 0.3s ease", // Smooth transition for all properties
  };

  // Canvas style with exact video dimensions
  const canvasStyle: CSSProperties = {
    width: `${videoWidth}px`,
    height: `${videoHeight}px`,
    transform: `scale(${zoomScale})`,
    transformOrigin: "top left",
    position: "absolute" as const,
    top: 0,
    left: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: currentScene?.backgroundColor || "black",
  };

  // Grid style for the overlay
  const gridStyle: CSSProperties = {
    width: `${videoWidth}px`,
    height: `${videoHeight}px`,
    transform: `scale(${zoomScale})`,
    transformOrigin: "top left",
    position: "absolute" as const,
    top: 0,
    left: 0,
    backgroundImage:
      "linear-gradient(to right, rgba(128, 128, 128, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.1) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
    zIndex: 10,
    display: showGrid ? "block" : "none",
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle navigation if user is typing in an input field
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.getAttribute("contenteditable") === "true" ||
          activeElement.getAttribute("role") === "textbox");

      if (isTyping) {
        return; // Don't interfere with text editing
      }

      if (e.key === "ArrowRight" && currentSceneIndex < scenes.length - 1) {
        setCurrentSceneIndex(currentSceneIndex + 1);
        selectScene(scenes[currentSceneIndex + 1].id);
      } else if (e.key === "ArrowLeft" && currentSceneIndex > 0) {
        setCurrentSceneIndex(currentSceneIndex - 1);
        selectScene(scenes[currentSceneIndex - 1].id);
      } else if (e.key === "Escape" && previewMode === "fullscreen") {
        // Exit fullscreen mode when Escape key is pressed
        setPreviewMode("normal");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSceneIndex, scenes, selectScene, previewMode]);

  // Handle preview playback
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(
        () => {
          setCurrentSceneIndex((prevIndex) => {
            const nextIndex = prevIndex + 1;
            if (nextIndex >= scenes.length) {
              setIsPlaying(false); // Stop at the end
              return prevIndex;
            }
            return nextIndex;
          });
        },
        currentScene ? currentScene.duration * 1000 : 3000
      );

      return () => clearInterval(interval);
    }
  }, [isPlaying, scenes.length, currentScene]);

  // Toggle fullscreen preview
  const toggleFullscreen = () => {
    setPreviewMode((prev) => (prev === "normal" ? "fullscreen" : "normal"));
  };

  // Start preview playback
  const startPreview = () => {
    setCurrentSceneIndex(0);
    setIsPlaying(true);
  };

  // Navigate to next scene
  const goToNextScene = () => {
    if (currentSceneIndex < scenes.length - 1) {
      const nextIndex = currentSceneIndex + 1;
      setCurrentSceneIndex(nextIndex);
      selectScene(scenes[nextIndex].id);
    }
  };

  // Navigate to previous scene
  const goToPrevScene = () => {
    if (currentSceneIndex > 0) {
      const prevIndex = currentSceneIndex - 1;
      setCurrentSceneIndex(prevIndex);
      selectScene(scenes[prevIndex].id);
    }
  };

  if (!currentScene) {
    return (
      <div
        className="flex justify-center items-center rounded border bg-card"
        style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
      >
        <div className="text-muted-foreground">No scenes available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Fullscreen overlay - only shown in fullscreen mode */}
      {previewMode === "fullscreen" && (
        <div
          className="fixed inset-0 z-40 bg-black/75"
          onClick={() => setPreviewMode("normal")}
        />
      )}

      {/* Preview controls */}
      <div className="flex justify-between items-center mb-4 w-full">
        <div className="flex">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={previewMode === "fullscreen" ? "default" : "ghost"}
                  size="icon"
                  onClick={toggleFullscreen}
                  className={
                    previewMode === "fullscreen"
                      ? "bg-indigo-600 text-white"
                      : ""
                  }
                >
                  <Fullscreen className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle fullscreen preview</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showGrid ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setShowGrid(!showGrid)}
                  className={showGrid ? "text-white bg-indigo-600" : ""}
                >
                  <Grid className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle grid overlay</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startPreview}
                  disabled={isPlaying}
                >
                  <Play className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Play preview</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-sm font-medium">
            {currentSceneIndex + 1} / {scenes.length}
          </span>
        </div>

        <div className="flex text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center">
                <LucideHelpCircle className="mr-1 w-4 h-4" />
                <span>
                  {formatDetails.name} • {formatDetails.width}×
                  {formatDetails.height}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Current video format dimensions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Canvas container */}
      <div className="scene-canvas-wrapper" style={{ position: "relative" }}>
        {/* Scene canvas with zoom */}
        <div style={containerStyle}>
          <div
            ref={canvasRef}
            className="scene-canvas"
            style={canvasStyle}
            data-scene-id={currentScene.id}
            data-scene-index={currentSceneIndex}
            data-format={formatDetails.width + "x" + formatDetails.height}
            data-width={formatDetails.width}
            data-height={formatDetails.height}
            onClick={handleCanvasClick}
          >
            {/* Exit fullscreen button - only shown in fullscreen mode */}
            {previewMode === "fullscreen" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="absolute top-2 right-2 z-50 text-white bg-black/30 hover:bg-black/50"
                      size="sm"
                      onClick={toggleFullscreen}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Exit fullscreen</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Scene background */}
            {(() => {
              const hasVideo = !!currentScene.videoUrl;
              const isAnimationReady =
                currentScene.animationStatus === "completed" ||
                currentScene.animationStatus === "ready";
              const useAnimated = currentScene.useAnimatedVersion !== false;
              const shouldShowVideo =
                hasVideo && isAnimationReady && useAnimated;

              console.log(
                `[SceneCanvas] Scene ${currentSceneIndex + 1} rendering:`,
                {
                  hasVideo,
                  isAnimationReady,
                  useAnimated,
                  shouldShowVideo,
                  animationStatus: currentScene.animationStatus,
                  useAnimatedVersion: currentScene.useAnimatedVersion,
                }
              );

              if (shouldShowVideo) {
                return (
                  <div className="overflow-hidden absolute inset-0">
                    <S3AssetMemoized
                      url={currentScene.videoUrl}
                      alt={`Scene ${currentSceneIndex + 1} Video`}
                      width={canvasWidth}
                      height={canvasHeight}
                      asBackgroundVideo
                      videoClassName="w-full h-full object-cover"
                      style={{ objectFit: "fill" }}
                    />
                  </div>
                );
              } else if (currentScene.imageUrl) {
                return (
                  <div className="overflow-hidden absolute inset-0">
                    <S3AssetMemoized
                      url={currentScene.imageUrl}
                      alt={`Scene ${currentSceneIndex + 1}`}
                      width={canvasWidth}
                      height={canvasHeight}
                      className="w-full h-full"
                      style={{ objectFit: "fill" }}
                      priority={true}
                    />
                  </div>
                );
              }
              return null;
            })()}

            {/* Render scene elements with improved data attributes */}
            {currentScene.elements && currentScene.elements.length > 0 ? (
              currentScene.elements.map((element) => (
                <div
                  key={element.id}
                  className={`element-renderer-container ${
                    state.selectedElementId === element.id
                      ? "element-selected"
                      : ""
                  }`}
                  data-element-id={element.id}
                  data-element-type={element.type}
                >
                  <ElementRenderer
                    element={element}
                    sceneId={currentScene.id}
                    isInteractive={true}
                    handleDragStart={(e) => handleDragStart(e, element.id)}
                    handleResizeStart={(e) => handleResizeStart(e, element.id)}
                    handleRotateStart={(e) => handleRotateStart(e, element.id)}
                    handleElementClick={(e) =>
                      handleElementClick(e, element.id)
                    }
                  />
                </div>
              ))
            ) : (
              <div className="absolute top-1/2 left-1/2 text-xs text-gray-400 opacity-50 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                No elements in this scene
              </div>
            )}

            {/* Scene duration indicator */}
            <div className="absolute bottom-4 left-4 px-4 py-3 text-3xl font-bold text-white rounded-lg border opacity-80 bg-black/90 border-white/20">
              {currentScene.duration}s
            </div>

            {/* Animation status indicator */}
            {currentScene.animationStatus &&
              currentScene.animationStatus !== "pending" && (
                <div
                  className={`absolute top-4 right-4 rounded-lg px-4 py-3 text-2xl opacity-80 font-bold text-white border border-white/20 ${
                    currentScene.animationStatus === "completed"
                      ? "bg-green-500/90"
                      : currentScene.animationStatus === "processing"
                        ? "bg-yellow-500/90"
                        : "bg-red-500/90"
                  }`}
                >
                  {currentScene.animationStatus === "completed"
                    ? "✓ Animated"
                    : currentScene.animationStatus === "processing"
                      ? "⟳ Processing"
                      : "✕ Failed"}
                </div>
              )}

            {/* AI Prompt indicator */}
            {currentScene.prompt && (
              <div className="absolute bottom-4 right-4 max-w-[90%] truncate rounded-lg bg-black/90 px-4 py-3 text-2xl opacity-80 font-bold text-white border border-white/20">
                AI: {currentScene.prompt.substring(0, 40)}...
              </div>
            )}
          </div>

          {/* Grid overlay */}
          <div style={gridStyle} />
        </div>

        {/* Navigation controls */}
        <div className="flex gap-2 justify-center items-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevScene}
            disabled={currentSceneIndex === 0}
            className="p-0 w-10 h-10 rounded-full"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextScene}
            disabled={currentSceneIndex === scenes.length - 1}
            className="p-0 w-10 h-10 rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
