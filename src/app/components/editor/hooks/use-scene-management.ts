"use client";

import { useState, useCallback } from "react";
import { useEditor } from "../context/editor-context";
import { useToast } from "@/app/components/ui/use-toast";
import { useSettings } from "@/app/contexts/settings-context";
import { unifiedAnimationService } from "@/app/utils/animation-service";
import { Scene } from "../types";

/**
 * Hook for managing scenes in the editor
 */
export function useSceneManagement() {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const { animationProvider } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);

  // Add a new empty scene
  const addEmptyScene = useCallback(() => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      order: state.scenes.length,
      duration: 3, // Default of 3 seconds, within the 1-5 second range
      elements: [],
    };

    dispatch({ type: "ADD_SCENE", payload: newScene });

    toast({
      title: "Scene added",
      description: "Added a new scene to your project",
    });
  }, [state.scenes.length, dispatch, toast]);

  // Add multiple scenes (e.g., AI-generated)
  const addScenes = useCallback(
    (scenes: Scene[]) => {
      // Check if this is a new scene marker or complete scenes update
      const isNewScene = scenes.length === 1 && scenes[0].isNewScene === true;

      if (isNewScene) {
        // Add as a new scene
        dispatch({ type: "ADD_SCENES", payload: scenes });

        toast({
          title: "Scene added",
          description: "New scene has been added to your project",
        });
      } else {
        // Complete scenes update
        dispatch({ type: "ADD_SCENES", payload: scenes });
      }
    },
    [dispatch, toast]
  );

  // Delete a scene
  const deleteScene = useCallback(
    (sceneId: string) => {
      if (state.scenes.length <= 1) {
        toast({
          variant: "destructive",
          title: "Cannot delete scene",
          description: "You must have at least one scene in your project",
        });
        return;
      }

      dispatch({ type: "DELETE_SCENE", payload: sceneId });

      toast({
        title: "Scene deleted",
        description: "Scene has been removed from your project",
      });
    },
    [state.scenes.length, dispatch, toast]
  );

  // Reorder scenes (e.g., after drag and drop)
  const reorderScenes = useCallback(
    (scenes: Scene[]) => {
      dispatch({ type: "REORDER_SCENES", payload: scenes });
    },
    [dispatch]
  );

  // Update scene properties
  const updateScene = useCallback(
    (sceneId: string, updates: Partial<Scene>) => {
      dispatch({
        type: "UPDATE_SCENE",
        payload: { sceneId, updates },
      });
    },
    [dispatch]
  );

  // Update scene duration
  const updateSceneDuration = useCallback(
    (sceneId: string, duration: number) => {
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId,
          updates: { duration },
        },
      });
    },
    [dispatch]
  );

  // Update scene background
  const updateSceneBackground = useCallback(
    (sceneId: string, imageUrl?: string, backgroundColor?: string) => {
      const updates: Partial<Scene> = {};

      if (imageUrl !== undefined) {
        updates.imageUrl = imageUrl;
      }

      if (backgroundColor !== undefined) {
        updates.backgroundColor = backgroundColor;
      }

      dispatch({
        type: "UPDATE_SCENE",
        payload: { sceneId, updates },
      });
    },
    [dispatch]
  );

  // Toggle scene animation
  const toggleSceneAnimation = useCallback(
    (sceneId: string, animate: boolean, animationPrompt?: string) => {
      // Convert boolean to proper animationStatus value
      const animationStatus = animate ? "ready" : "none";

      console.log(
        `Toggling animation for scene ${sceneId} to: ${animate ? "enabled" : "disabled"} (status: ${animationStatus})`
      );

      const updates: Partial<Scene> = {
        animate: animate, // Explicitly set the boolean flag
        animationStatus, // Also set the status string
      };

      if (animationPrompt !== undefined) {
        updates.animationPrompt = animationPrompt;
      }

      dispatch({
        type: "UPDATE_SCENE",
        payload: { sceneId, updates },
      });

      // Log the state to ensure the scene was properly updated
      console.log(`Updated scene ${sceneId} animation settings:`, {
        animate,
        animationStatus,
        hasPrompt: !!animationPrompt,
      });
    },
    [dispatch]
  );

  // Generate animation for a scene
  const generateSceneAnimation = useCallback(
    async (sceneId: string, customPrompt?: string) => {
      const scene = state.scenes.find((s) => s.id === sceneId);
      if (!scene) return;

      setIsGenerating(true);

      try {
        // Update animation status to processing
        dispatch({
          type: "UPDATE_SCENE",
          payload: {
            sceneId,
            updates: { animationStatus: "processing" },
          },
        });

        // Use custom prompt if provided, otherwise fall back to scene's prompts
        const promptToUse =
          customPrompt || scene.animationPrompt || scene.prompt || "";

        // Comprehensive logging of what data is being sent to animation generation API
        const requestData = {
          sceneId,
          imageUrl: scene.imageUrl,
          prompt: promptToUse,
          duration: scene.duration,
        };

        console.log("🪄 MAGIC WAND ANIMATION GENERATION - REQUEST DATA:");
        console.log(
          "================================================================"
        );
        console.log("Scene ID:", sceneId);
        console.log("Scene Order:", scene.order);
        console.log(
          "Selected Scene Index:",
          state.scenes.findIndex((s) => s.id === sceneId) + 1
        );
        console.log("Image URL:", scene.imageUrl);
        console.log(
          "Custom Prompt (from magic wand):",
          customPrompt || "(none - using fallback)"
        );
        console.log(
          "Scene Animation Prompt:",
          scene.animationPrompt || "(none)"
        );
        console.log("Scene Original Prompt:", scene.prompt || "(none)");
        console.log("Final Prompt Being Sent:", promptToUse);
        console.log("Duration:", scene.duration);
        console.log("Scene Animation Status:", scene.animationStatus);
        console.log("Scene Animate Flag:", scene.animate);
        console.log("Complete Scene Object:", scene);
        console.log("Complete Request Payload:", requestData);
        console.log(
          "================================================================"
        );

        // Use unified animation service based on user settings
        console.log("🔄 Using animation provider:", animationProvider);

        // Calculate animation duration based on scene duration
        // If scene duration <= 5 seconds, use 5 second animation
        // If scene duration > 5 seconds, use 10 second animation
        const animationDuration = scene.duration > 5 ? "10" : "5";
        
        const animationResult = await unifiedAnimationService.generateAnimation(
          {
            imageUrl: scene.imageUrl || "",
            prompt: promptToUse,
            provider: animationProvider,
            // Bytedance-specific options
            resolution: "720p",
            duration: animationDuration,
            cameraFixed: false,
          }
        );

        if (animationResult.videoUrl) {
          console.log("✅ Animation generated successfully:", {
            provider: animationResult.provider,
            videoUrl: animationResult.videoUrl.substring(0, 100) + "...",
            cost: animationResult.cost,
            metadata: animationResult.metadata,
          });

          // Update scene with animation data
          dispatch({
            type: "UPDATE_SCENE",
            payload: {
              sceneId,
              updates: {
                videoUrl: animationResult.videoUrl,
                animationStatus: "completed",
                animationPrompt: promptToUse, // Use the prompt that was actually sent
                animate: true, // Enable animation flag
                useAnimatedVersion: true, // Auto-enable use animated version
              },
            },
          });

          // Save to animation history
          try {
            const historyResponse = await fetch(
              `/api/scenes/${sceneId}/animation-history`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  videoUrl: animationResult.videoUrl,
                  animationPrompt: promptToUse, // Use the prompt that was sent to the animation service
                  animationStatus: "completed",
                  timestamp: Date.now(),
                  sourceImageUrl: scene.imageUrl, // Track which background image was animated
                  provider: animationResult.provider, // Track which provider was used
                }),
              }
            );

            if (historyResponse.ok) {
              console.log(
                "[generateSceneAnimation] Successfully saved animation to history"
              );
              const historyResult = await historyResponse.json();
              console.log(
                "[generateSceneAnimation] History save result:",
                historyResult
              );

              // Trigger a global state update to refresh any UI components
              // that depend on animation history (like the scene panel)
              window.dispatchEvent(
                new CustomEvent("animationHistoryUpdated", {
                  detail: { sceneId },
                })
              );
            } else {
              console.error(
                "[generateSceneAnimation] Failed to save animation history:",
                historyResponse.status,
                historyResponse.statusText
              );
            }
          } catch (historyError) {
            console.error(
              "[generateSceneAnimation] Failed to save animation history:",
              historyError
            );
            // Don't fail the whole operation if history save fails
          }

          toast({
            title: "Animation Complete",
            description: "Your scene is now animated!",
          });
        } else {
          throw new Error("No video URL returned");
        }
      } catch (error) {
        console.error("Animation error:", error);

        // Update animation status to failed
        dispatch({
          type: "UPDATE_SCENE",
          payload: {
            sceneId,
            updates: { animationStatus: "failed" },
          },
        });

        toast({
          variant: "destructive",
          title: "Animation Failed",
          description: "Could not generate the animation. Please try again.",
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [state.scenes, dispatch, toast]
  );

  // Calculate total project duration
  const getTotalDuration = useCallback(() => {
    return state.scenes.reduce((total, scene) => total + scene.duration, 0);
  }, [state.scenes]);

  return {
    scenes: state.scenes,
    selectedSceneId: state.selectedSceneId,
    isGenerating,
    addEmptyScene,
    addScenes,
    deleteScene,
    reorderScenes,
    updateScene,
    updateSceneDuration,
    updateSceneBackground,
    toggleSceneAnimation,
    generateSceneAnimation,
    getTotalDuration,
    selectScene: (sceneId: string | null) => {
      dispatch({ type: "SELECT_SCENE", payload: sceneId });
    },
  };
}
