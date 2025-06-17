"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import { Slider } from "@/app/components/ui/slider";
import { Switch } from "@/app/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { useEditor } from "../context/editor-context";
import { useSceneManagement } from "../hooks/use-scene-management";
import { useAssetManagement } from "../hooks/use-asset-management";
import { useVideoFormat } from "@/app/contexts/format-context";
import AIPromptModal from "../ai-prompt-modal";
import {
  Sparkles,
  ImageIcon,
  Wand2,
  Play,
  Pause,
  RotateCw,
  Upload,
  Settings,
  Clock,
  Film,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Plus,
  Eye,
  EyeOff,
  FileImage,
  RefreshCw,
  Layers,
  Video,
  Timer,
  Zap,
  History,
  Grid3X3,
  ArrowRight,
  ExternalLink,
  ArrowDown,
  Mic,
  X,
  Image,
  Copy,
} from "lucide-react";

type ScenePanelProps = {
  toast: {
    (props: {
      title: string;
      description?: string;
      variant?: "default" | "destructive";
    }): void;
  };
  scenes?: any[];
  selectedScene?: any;
  selectedSceneId?: string | null;
  onAddScenes?: (scenes: any[]) => void;
  onUpdateSceneDuration?: (sceneId: string, duration: number) => void;
  onUpdateSceneBackground?: (
    sceneId: string,
    imageUrl?: string,
    backgroundColor?: string
  ) => void;
  onToggleAnimation?: (
    sceneId: string,
    animate: boolean,
    prompt?: string
  ) => void;
};

export default function ScenePanel({
  toast,
  scenes,
  selectedScene,
  selectedSceneId,
  onAddScenes,
  onUpdateSceneDuration,
  onUpdateSceneBackground,
  onToggleAnimation,
}: ScenePanelProps) {
  const { state, dispatch, handleUpdateSceneDuration, syncToDatabase } =
    useEditor();
  const {
    updateSceneDuration,
    updateSceneBackground,
    toggleSceneAnimation,
    generateSceneAnimation,
    isGenerating,
  } = useSceneManagement();
  const { setAssetAsBackground } = useAssetManagement();
  const { currentFormat } = useVideoFormat();

  // Local state
  const [fluxPrompt, setFluxPrompt] = useState("");
  const [isFluxGenerating, setIsFluxGenerating] = useState(false);
  const [backgroundHistory, setBackgroundHistory] = useState<
    Array<{
      url: string;
      prompt: string;
      timestamp: number;
      isOriginal?: boolean;
    }>
  >([]);
  const [refreshedBackgroundHistory, setRefreshedBackgroundHistory] = useState<
    Array<{
      url: string;
      prompt: string;
      timestamp: number;
      isOriginal?: boolean;
    }>
  >([]);
  const [animationHistory, setAnimationHistory] = useState<
    Array<{
      videoUrl: string;
      animationPrompt: string;
      animationStatus: string;
      timestamp: number;
      isOriginal?: boolean;
      sourceImageUrl?: string;
    }>
  >([]);
  const [currentDuration, setCurrentDuration] = useState(3);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPromptType, setAIPromptType] = useState<"scene" | "background">(
    "background"
  );
  const [localAnimationPrompt, setLocalAnimationPrompt] = useState<string>("");
  const [selectedStaticImage, setSelectedStaticImage] = useState<string | null>(
    null
  );
  const [useAnimatedVersion, setUseAnimatedVersion] = useState<boolean>(false);
  const [currentSceneImageUrl, setCurrentSceneImageUrl] = useState<
    string | undefined
  >(undefined);
  const [currentSceneVideoUrl, setCurrentSceneVideoUrl] = useState<
    string | undefined
  >(undefined);
  const [refreshedSelectedStaticImage, setRefreshedSelectedStaticImage] =
    useState<string | null>(null);
  const [isGeneratingAnimationPrompt, setIsGeneratingAnimationPrompt] =
    useState(false);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [refreshedAdditionalImages, setRefreshedAdditionalImages] = useState<
    string[]
  >([]);
  const [showImageSelector, setShowImageSelector] = useState(false);

  // Get the selected scene
  const selectedSceneFromContext = state.selectedSceneId
    ? state.scenes.find((scene) => scene.id === state.selectedSceneId)
    : null;

  const selectedSceneToUse = selectedScene || selectedSceneFromContext;

  // Helper functions (keeping all your existing functions)
  const extractS3Key = (url: string) => {
    if (!url) return null;
    const patterns = [
      /\/[^/]+\/(.+?)(\?|$)/, // /bucket/key/path/file.jpg
      /\.com\/(.+?)(\?|$)/, // domain.com/key/path/file.jpg
      /\/(.+?)(\?|$)/, // fallback: everything after first slash
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return url;
  };

  const getFreshPresignedUrl = useCallback(
    async (url: string): Promise<string> => {
      if (
        !url ||
        (!url.includes("wasabisys.com") &&
          !url.includes("amazonaws.com") &&
          !url.includes("s3."))
      ) {
        return url;
      }

      try {
        const response = await fetch("/api/s3/presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (response.ok) {
          const result = await response.json();
          return result.presignedUrl || url;
        }
      } catch (error) {
        console.error("[getFreshPresignedUrl] Error:", error);
      }

      return url;
    },
    []
  );

  const loadBackgroundHistory = async () => {
    if (!selectedSceneToUse?.id) return;

    try {
      const response = await fetch(
        `/api/scenes/${selectedSceneToUse.id}/background-history`
      );
      if (response.ok) {
        const result = await response.json();
        const dbHistory = result.data.history || [];

        // Deduplicate history based on URL (extract S3 key for comparison)
        const uniqueHistory = new Map();

        // Process database history
        for (const item of dbHistory) {
          const s3Key = extractS3Key(item.url);
          if (s3Key && !uniqueHistory.has(s3Key)) {
            uniqueHistory.set(s3Key, item);
          }
        }

        let fullHistory = Array.from(uniqueHistory.values());

        // Add original image if not in history and no existing original found
        const hasOriginalInHistory = fullHistory.some(
          (item) => item.isOriginal
        );

        if (selectedSceneToUse.imageUrl && !hasOriginalInHistory) {
          const originalKey = extractS3Key(selectedSceneToUse.imageUrl);
          if (originalKey && !uniqueHistory.has(originalKey)) {
            const freshOriginalUrl = await getFreshPresignedUrl(
              selectedSceneToUse.imageUrl
            );

            fullHistory = [
              {
                url: freshOriginalUrl,
                prompt: "Original image",
                timestamp: 0,
                isOriginal: true,
              },
              ...fullHistory,
            ];
          }
        }

        // Sort by timestamp (newest first, except original which stays first)
        fullHistory.sort((a, b) => {
          if (a.isOriginal) return -1;
          if (b.isOriginal) return 1;
          return b.timestamp - a.timestamp;
        });

        setBackgroundHistory(fullHistory);

        // Also create refreshed version for display
        const refreshedHistory = await Promise.all(
          fullHistory.map(async (item) => {
            try {
              const refreshedUrl = await getFreshPresignedUrl(item.url);
              return { ...item, url: refreshedUrl };
            } catch (error) {
              console.error("Failed to refresh background history URL:", error);
              return item; // Fallback to original
            }
          })
        );
        setRefreshedBackgroundHistory(refreshedHistory);
      } else {
        // If error or no history, clear the background history
        setBackgroundHistory([]);
        setRefreshedBackgroundHistory([]);
      }
    } catch (error) {
      console.error("Failed to load background history:", error);
      setBackgroundHistory([]);
      setRefreshedBackgroundHistory([]);
    }
  };

  const saveBackgroundHistoryEntry = async (entry: {
    url: string;
    prompt: string;
    timestamp: number;
  }) => {
    if (!selectedSceneToUse?.id) return;

    try {
      // Check if this URL already exists in history (by S3 key)
      const entryKey = extractS3Key(entry.url);
      const isDuplicate = backgroundHistory.some((item) => {
        const itemKey = extractS3Key(item.url);
        return entryKey && itemKey && entryKey === itemKey;
      });

      if (!isDuplicate) {
        await fetch(`/api/scenes/${selectedSceneToUse.id}/background-history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      }
    } catch (error) {
      console.error("Failed to save background history:", error);
    }
  };

  const loadAnimationHistory = useCallback(async () => {
    if (!selectedSceneToUse?.id) return;

    try {
      const response = await fetch(
        `/api/scenes/${selectedSceneToUse.id}/animation-history`
      );

      if (response.ok) {
        const result = await response.json();
        const dbHistory = result.data.history || [];

        let fullHistory = [...dbHistory];
        const currentAnimation = result.data.currentAnimation;

        if (
          currentAnimation?.videoUrl &&
          !dbHistory.some(
            (item: any) => item.videoUrl === currentAnimation.videoUrl
          )
        ) {
          const freshVideoUrl = await getFreshPresignedUrl(
            currentAnimation.videoUrl
          );

          fullHistory = [
            {
              videoUrl: freshVideoUrl,
              animationPrompt:
                currentAnimation.animationPrompt || "Original animation",
              animationStatus: currentAnimation.animationStatus || "completed",
              timestamp: 0,
              isOriginal: true,
            },
            ...dbHistory,
          ];
        }

        setAnimationHistory(fullHistory);
      }
    } catch (error) {
      console.error("[loadAnimationHistory] Failed:", error);
    }
  }, [selectedSceneToUse?.id, getFreshPresignedUrl, setAnimationHistory]);

  const refreshCurrentSceneUrls = async () => {
    if (!selectedSceneToUse) return;

    if (selectedSceneToUse.imageUrl) {
      try {
        const freshImageUrl = await getFreshPresignedUrl(
          selectedSceneToUse.imageUrl
        );
        setCurrentSceneImageUrl(freshImageUrl);
      } catch (error) {
        setCurrentSceneImageUrl(selectedSceneToUse.imageUrl);
      }
    } else {
      setCurrentSceneImageUrl(undefined);
    }

    if (selectedSceneToUse.videoUrl) {
      try {
        const freshVideoUrl = await getFreshPresignedUrl(
          selectedSceneToUse.videoUrl
        );
        setCurrentSceneVideoUrl(freshVideoUrl);
      } catch (error) {
        setCurrentSceneVideoUrl(selectedSceneToUse.videoUrl);
      }
    } else {
      setCurrentSceneVideoUrl(undefined);
    }
  };

  const handleFluxEdit = async (promptToUse?: string) => {
    const finalPrompt = promptToUse || fluxPrompt;

    if (!finalPrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Describe what you want to create or edit.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSceneToUse?.id) return;

    setIsFluxGenerating(true);

    try {
      if (!selectedSceneToUse?.imageUrl) {
        // Generate new background using regular Runware API
        const response = await fetch("/api/ai/generate-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: finalPrompt,
            format: currentFormat,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || "Failed to generate image");
        }

        const result = await response.json();
        const rawImageUrl = result.background?.imageUrl;

        // Get fresh presigned URL immediately after generation
        const freshImageUrl = await getFreshPresignedUrl(rawImageUrl);

        updateSceneBackground(selectedSceneToUse.id, freshImageUrl);
        onUpdateSceneBackground?.(selectedSceneToUse.id, freshImageUrl);

        dispatch({
          type: "UPDATE_SCENE",
          payload: {
            sceneId: selectedSceneToUse.id,
            updates: { imageUrl: freshImageUrl },
          },
        });

        // For AI-generated original backgrounds, add to history as "Original image"
        const historyEntry = {
          url: freshImageUrl,
          prompt: "Original image",
          timestamp: 0,
          isOriginal: true,
        };

        // Only add to history if not duplicate
        const entryKey = extractS3Key(historyEntry.url);
        const isDuplicate = backgroundHistory.some((item) => {
          const itemKey = extractS3Key(item.url);
          return entryKey && itemKey && entryKey === itemKey;
        });

        if (!isDuplicate) {
          setBackgroundHistory((prev) => [...prev, historyEntry]);
        }
        await saveBackgroundHistoryEntry(historyEntry);

        toast({
          title: "Background generated!",
          description: `Created: "${finalPrompt}"`,
        });

        // Manually trigger sync to database
        await syncToDatabase();

        // Refresh current scene URLs to ensure the image displays properly
        await refreshCurrentSceneUrls();

        // Reload background history to show the new original image
        await loadBackgroundHistory();
      } else {
        // Edit existing background
        const imageUrlToUse =
          currentSceneImageUrl || selectedSceneToUse.imageUrl;
        const endpoint = "/api/ai/flux-kontext/edit-image";

        const requestBody = {
          referenceImageUrl: imageUrlToUse,
          additionalImages: additionalImages,
          editPrompt: finalPrompt,
          format: currentFormat,
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || "Failed to process image");
        }

        const result = await response.json();
        const newImageUrl = result.data.imageURL || result.data.imageUrl;

        updateSceneBackground(selectedSceneToUse.id, newImageUrl);
        onUpdateSceneBackground?.(selectedSceneToUse.id, newImageUrl);

        dispatch({
          type: "UPDATE_SCENE",
          payload: {
            sceneId: selectedSceneToUse.id,
            updates: { imageUrl: newImageUrl },
          },
        });

        const historyEntry = {
          url: newImageUrl,
          prompt: finalPrompt,
          timestamp: Date.now(),
        };

        // Only add to history if not duplicate
        const entryKey = extractS3Key(historyEntry.url);
        const isDuplicate = backgroundHistory.some((item) => {
          const itemKey = extractS3Key(item.url);
          return entryKey && itemKey && entryKey === itemKey;
        });

        if (!isDuplicate) {
          setBackgroundHistory((prev) => [...prev, historyEntry]);
        }
        await saveBackgroundHistoryEntry(historyEntry);

        toast({
          title: "Background edited!",
          description: `Applied: "${finalPrompt}"`,
        });

        // Manually trigger sync to database
        await syncToDatabase();
      }

      if (!promptToUse) {
        setFluxPrompt("");
      }
    } catch (error) {
      console.error("Flux error:", error);
      toast({
        title: "Operation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsFluxGenerating(false);
    }
  };

  const handleDurationChange = (value: number[]) => {
    if (selectedSceneToUse?.id) {
      const newDuration = value[0];
      setCurrentDuration(newDuration);

      updateSceneDuration(selectedSceneToUse.id, newDuration);
      onUpdateSceneDuration?.(selectedSceneToUse.id, newDuration);
      handleUpdateSceneDuration?.(selectedSceneToUse.id, newDuration);

      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedSceneToUse.id,
          updates: { duration: newDuration },
        },
      });
    }
  };

  const handleSetSceneBackground = (color: string) => {
    if (selectedSceneToUse?.id) {
      updateSceneBackground(selectedSceneToUse.id, undefined, color);
      onUpdateSceneBackground?.(selectedSceneToUse.id, undefined, color);
    }
  };

  const handleSceneImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSceneToUse?.id) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", "image");

      const uploadResponse = await fetch("/api/s3/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadResult = await uploadResponse.json();
      const s3Url = uploadResult.asset?.url || uploadResult.url;

      updateSceneBackground(selectedSceneToUse.id, s3Url);
      onUpdateSceneBackground?.(selectedSceneToUse.id, s3Url);

      // Dispatch scene update to ensure state is properly updated
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedSceneToUse.id,
          updates: { imageUrl: s3Url },
        },
      });

      // Save to background history
      // If this is the first image for the scene, it becomes the "Original image"
      // If there's already an original image, this is a "Custom uploaded image"
      const isFirstImage = !selectedSceneToUse.imageUrl;
      const historyEntry = {
        url: s3Url,
        prompt: isFirstImage ? "Original image" : "Custom uploaded image",
        timestamp: isFirstImage ? 0 : Date.now(),
        isOriginal: isFirstImage,
      };

      // Only add to history if not duplicate
      const entryKey = extractS3Key(historyEntry.url);
      const isDuplicate = backgroundHistory.some((item) => {
        const itemKey = extractS3Key(item.url);
        return entryKey && itemKey && entryKey === itemKey;
      });

      if (!isDuplicate) {
        setBackgroundHistory((prev) => [...prev, historyEntry]);
      }
      await saveBackgroundHistoryEntry(historyEntry);

      toast({
        title: "Background uploaded",
        description: "Scene background updated successfully!",
      });

      // Manually trigger sync to database
      await syncToDatabase();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload background image",
        variant: "destructive",
      });
    }
  };

  const restoreBackground = async (
    historyItem: (typeof backgroundHistory)[0]
  ) => {
    if (selectedSceneToUse?.id) {
      updateSceneBackground(selectedSceneToUse.id, historyItem.url);
      onUpdateSceneBackground?.(selectedSceneToUse.id, historyItem.url);

      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedSceneToUse.id,
          updates: { imageUrl: historyItem.url },
        },
      });

      toast({
        title: "Background restored",
        description: `Restored: "${historyItem.prompt}"`,
      });
    }
  };

  const handleOpenAIPrompt = (type: "scene" | "background") => {
    setAIPromptType(type);
    setIsAIModalOpen(true);
  };

  const handleAIGenerate = (result: any) => {
    if (!selectedSceneToUse?.id) return;

    if (aiPromptType === "scene") {
      if (Array.isArray(result) && result.length > 0) {
        const newScenes = result.map((scene, index) => ({
          id: `ai-scene-${Date.now()}-${index}`,
          order: (scenes?.length || 0) + index,
          duration: Math.min(scene.duration || 3, 5),
          imageUrl: scene.imageUrl,
          prompt: scene.prompt,
          elements: [],
        }));

        onAddScenes?.(newScenes);

        toast({
          title: "Scenes Added",
          description: `Added ${newScenes.length} new scenes to your project.`,
        });
      }
    } else if (aiPromptType === "background") {
      if (result && result.url) {
        updateSceneBackground(selectedSceneToUse.id, result.url);
        onUpdateSceneBackground?.(selectedSceneToUse.id, result.url);

        toast({
          title: "Background Updated",
          description:
            "Generated background has been applied to the current scene",
        });
      }
    }
  };

  const handleAdditionalImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", "image");

      const uploadResponse = await fetch("/api/s3/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadResult = await uploadResponse.json();
      const s3Url = uploadResult.asset?.url || uploadResult.url;

      setAdditionalImages((prev) => [...prev, s3Url]);

      toast({
        title: "Reference image added",
        description: "Additional reference image uploaded successfully!",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload reference image",
        variant: "destructive",
      });
    }
  };

  const handleAddFromBackgroundHistory = (imageUrl: string) => {
    if (!additionalImages.includes(imageUrl)) {
      setAdditionalImages((prev) => [...prev, imageUrl]);
      toast({
        title: "Reference image added",
        description: "Image added from background history",
      });
    }
    setShowImageSelector(false);
  };

  const handleRemoveAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
    setRefreshedAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const refreshAdditionalImages = async () => {
    if (additionalImages.length === 0) {
      setRefreshedAdditionalImages([]);
      return;
    }

    try {
      const refreshedUrls = await Promise.all(
        additionalImages.map(async (url) => {
          try {
            return await getFreshPresignedUrl(url);
          } catch (error) {
            console.error("Failed to refresh additional image URL:", error);
            return url; // Fallback to original URL
          }
        })
      );
      setRefreshedAdditionalImages(refreshedUrls);
    } catch (error) {
      console.error("Error refreshing additional images:", error);
      setRefreshedAdditionalImages(additionalImages); // Fallback
    }
  };

  // Helper function to copy text to clipboard
  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${description} copied successfully`,
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Helper function to get the current prompt to display
  const getCurrentPrompt = () => {
    // For animated version, use the scene's animationPrompt (which now contains the final Runway prompt)
    if (useAnimatedVersion && selectedSceneToUse.animationPrompt) {
      return {
        text: selectedSceneToUse.animationPrompt,
        type: "animation" as const,
      };
    }

    // For static background, try to find the prompt from background history
    if (selectedStaticImage) {
      const selectedImageKey = extractS3Key(selectedStaticImage);
      const selectedBackgroundEntry = backgroundHistory.find((item) => {
        const itemKey = extractS3Key(item.url);
        return selectedImageKey && itemKey && selectedImageKey === itemKey;
      });

      if (
        selectedBackgroundEntry &&
        selectedBackgroundEntry.prompt !== "Custom uploaded image"
      ) {
        return {
          text: selectedBackgroundEntry.prompt,
          type: "image" as const,
        };
      }
    }

    return null;
  };

  const handleGenerateAnimationPrompt = async () => {
    if (!selectedStaticImage || !backgroundHistory.length) {
      toast({
        title: "No background selected",
        description: "Please select a background image first",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAnimationPrompt(true);

    try {
      // Find the prompt for the selected static image
      const selectedImageKey = extractS3Key(selectedStaticImage);
      const selectedBackgroundEntry = backgroundHistory.find((item) => {
        const itemKey = extractS3Key(item.url);
        return selectedImageKey && itemKey && selectedImageKey === itemKey;
      });

      let backgroundPrompt = selectedBackgroundEntry?.prompt || "image";

      // If this is a custom uploaded image without a real prompt, use vision AI to analyze it first
      if (
        backgroundPrompt === "Custom uploaded image" ||
        backgroundPrompt === "Original image"
      ) {
        toast({
          title: "Analyzing image...",
          description: "Using AI vision to understand your image first",
        });

        try {
          // Get a fresh presigned URL for the image before sending to OpenAI Vision
          const freshImageUrl = await getFreshPresignedUrl(selectedStaticImage);

          const visionResponse = await fetch("/api/ai/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: freshImageUrl,
              prompt:
                "Describe this image in detail for video animation purposes. Focus on the main subject, setting, colors, mood, composition, and any elements that would be interesting to animate. Keep it concise but descriptive.",
            }),
          });

          if (visionResponse.ok) {
            const visionResult = await visionResponse.json();
            backgroundPrompt = visionResult.description || backgroundPrompt;

            // Update the background history with the new AI-generated description
            if (visionResult.description && selectedBackgroundEntry) {
              const updatedEntry = {
                ...selectedBackgroundEntry,
                prompt: visionResult.description,
                timestamp: Date.now(),
              };

              // Update local state
              setBackgroundHistory((prev) =>
                prev.map((item) =>
                  extractS3Key(item.url) === extractS3Key(selectedStaticImage)
                    ? updatedEntry
                    : item
                )
              );

              // Save to backend
              await saveBackgroundHistoryEntry(updatedEntry);
            }

            toast({
              title: "Image analyzed!",
              description: "Now generating animation prompt...",
            });
          } else {
            console.warn("Vision analysis failed, using generic prompt");
          }
        } catch (visionError) {
          console.error("Vision analysis error:", visionError);
          // Continue with the original prompt if vision fails
        }
      }

      // Create AI prompt for generating animation suggestions using professional video prompt template
      const aiPrompt = `You are a video motion expert specializing in Runway Gen-4 video generation. Your task is to transform a detailed image prompt into a visually compelling and emotionally engaging video prompt ideal for advertising use.

INPUT IMAGE PROMPT:
${backgroundPrompt}

GOAL:
Generate a motion prompt that enhances the image with striking, tasteful, and ad-friendly animation — designed to catch attention, evoke emotion, or add atmosphere, while keeping the scene coherent and focused.

GUIDELINES FOR VIDEO PROMPT CREATION:
1. Focus primarily on describing MOTION, not static elements.
2. Use simple, direct language that describes specific physical or visual movements.
3. Refer to subjects in general terms (e.g., "the subject", "the woman", "the car").
4. Include only 1–3 motion elements to avoid conflict or clutter.
5. Structure the prompt in this order:
   - Subject motion (how characters or objects move)
   - Scene motion (environmental, lighting, or atmospheric effects)
   - Camera motion (if any)
   - Style descriptor (e.g., "cinematic live-action", "stylized motion graphics", "smooth animation")

MOTION TYPES TO CONSIDER:
- Subject Motion: E.g., "the boy reaches toward the sky", "the product gently rotates"
- Scene Motion: E.g., "soft glow pulses from the background", "light particles drift upward", "wind ripples fabric"
- Camera Motion: E.g., "slow zoom out", "locked camera", "subtle parallax movement"
- Visual Enhancements: E.g., "glowing outline pulses", "highlight streak moves across surface", "subtle distortion adds energy"

BEST PRACTICES:
- Use only positive phrasing (what should happen, not what shouldn't).
- Keep prompt under 100 words for best results.
- Focus on a single scene with consistent, tasteful motion.
- Avoid overly complex sequences or multiple transitions.
- Don't repeat details already visible in the image prompt — just describe how they move.

EXAMPLES OF EFFECTIVE VIDEO PROMPTS:
1. "The subject turns and smiles softly. Sunlight flickers across their face. Gentle zoom in. Cinematic live-action."
2. "The product rotates slowly in mid-air. Glowing highlights shimmer across its surface. Locked camera. Stylized motion graphics."
3. "Wind flows through tall grass in the foreground. Soft particles rise in the background. Static frame. Dreamy animation."

Create a concise, effective video prompt for animation creation based on the input image prompt. Keep it impactful and ad-ready.`;

      // Use the AI text generation endpoint
      const response = await fetch("/api/ai/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          maxTokens: 100,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("API error response:", errorData);
        throw new Error(
          `Failed to generate animation prompt: ${errorData?.error || response.statusText}`
        );
      }

      const result = await response.json();

      // Extract the text from the response
      let suggestedPrompt = result.text || "Gentle camera movement";

      // Clean up the generated prompt (remove quotes, extra text, etc.)
      suggestedPrompt = suggestedPrompt
        .replace(/['"]/g, "")
        .replace(/^(Animation:|Camera:|Movement:)/i, "")
        .trim();

      // Log the full prompt for debugging
      console.log("🎭 ANIMATION PROMPT GENERATION RESULT:");
      console.log(
        "================================================================"
      );
      console.log("Raw AI Response:", result);
      console.log("Extracted Text:", result.text);
      console.log("Cleaned Prompt:", suggestedPrompt);
      console.log("Prompt Length:", suggestedPrompt.length);
      console.log(
        "================================================================"
      );

      setLocalAnimationPrompt(suggestedPrompt);

      toast({
        title: "Animation prompt generated!",
        description: `AI suggested: "${suggestedPrompt}"`,
      });
    } catch (error) {
      console.error("Error generating animation prompt:", error);
      toast({
        title: "Generation failed",
        description: "Failed to generate animation prompt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAnimationPrompt(false);
    }
  };

  // Effects
  useEffect(() => {
    if (selectedSceneToUse) {
      setCurrentDuration(selectedSceneToUse.duration);
      setSelectedStaticImage(selectedSceneToUse.imageUrl || null);
      setUseAnimatedVersion(
        selectedSceneToUse.useAnimatedVersion ?? !!selectedSceneToUse.videoUrl
      );

      // Clear history when switching scenes
      setBackgroundHistory([]);
      setRefreshedBackgroundHistory([]);
      setAnimationHistory([]);
      setAdditionalImages([]);
      setRefreshedAdditionalImages([]);
      setShowImageSelector(false);

      // Then load the new scene's history
      loadBackgroundHistory();
      loadAnimationHistory();
      refreshCurrentSceneUrls();
    } else {
      // Clear everything if no scene is selected
      setBackgroundHistory([]);
      setRefreshedBackgroundHistory([]);
      setAnimationHistory([]);
      setAdditionalImages([]);
      setRefreshedAdditionalImages([]);
      setShowImageSelector(false);
      setSelectedStaticImage(null);
      setUseAnimatedVersion(false);
    }
  }, [selectedSceneToUse?.id]);

  useEffect(() => {
    refreshCurrentSceneUrls();
  }, [selectedSceneToUse?.imageUrl, selectedSceneToUse?.videoUrl]);

  // Update useAnimatedVersion when scene animation status changes
  useEffect(() => {
    if (selectedSceneToUse) {
      const hasVideoUrl = !!selectedSceneToUse.videoUrl;
      const isAnimationCompleted =
        selectedSceneToUse.animationStatus === "completed";
      const shouldUseAnimated =
        selectedSceneToUse.useAnimatedVersion ??
        (hasVideoUrl && isAnimationCompleted);

      if (shouldUseAnimated !== useAnimatedVersion) {
        console.log("[ScenePanel] Updating useAnimatedVersion:", {
          sceneId: selectedSceneToUse.id,
          hasVideoUrl,
          isAnimationCompleted,
          currentUseAnimated: useAnimatedVersion,
          newUseAnimated: shouldUseAnimated,
        });
        setUseAnimatedVersion(shouldUseAnimated);
      }
    }
  }, [
    selectedSceneToUse?.videoUrl,
    selectedSceneToUse?.animationStatus,
    selectedSceneToUse?.useAnimatedVersion,
  ]);

  // Listen for animation history updates
  useEffect(() => {
    const handleAnimationHistoryUpdate = (event: CustomEvent) => {
      const { sceneId } = event.detail;
      if (sceneId === selectedSceneToUse?.id) {
        console.log("[ScenePanel] Animation history updated, refreshing...");
        loadAnimationHistory();
      }
    };

    window.addEventListener(
      "animationHistoryUpdated",
      handleAnimationHistoryUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "animationHistoryUpdated",
        handleAnimationHistoryUpdate as EventListener
      );
    };
  }, [selectedSceneToUse?.id, loadAnimationHistory]);

  // Effect to refresh selected static image URL
  useEffect(() => {
    const refreshSelectedStaticImage = async () => {
      if (selectedStaticImage) {
        try {
          const freshUrl = await getFreshPresignedUrl(selectedStaticImage);
          setRefreshedSelectedStaticImage(freshUrl);
        } catch (error) {
          console.error("Failed to refresh selected static image URL:", error);
          setRefreshedSelectedStaticImage(selectedStaticImage);
        }
      } else {
        setRefreshedSelectedStaticImage(null);
      }
    };

    refreshSelectedStaticImage();
  }, [selectedStaticImage]);

  useEffect(() => {
    if (selectedSceneToUse?.animationPrompt !== undefined) {
      setLocalAnimationPrompt(selectedSceneToUse.animationPrompt || "");
    } else if (selectedSceneToUse?.prompt) {
      setLocalAnimationPrompt(selectedSceneToUse.prompt);
    } else {
      setLocalAnimationPrompt("");
    }
  }, [selectedSceneToUse?.id]);

  // Effect to refresh additional images whenever they change
  useEffect(() => {
    refreshAdditionalImages();
  }, [additionalImages]);

  if (!selectedSceneToUse) {
    return (
      <div className="flex flex-col justify-center items-center p-8 h-full">
        <div className="flex justify-center items-center mb-6 w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full dark:from-purple-900/20 dark:to-blue-900/20">
          <Layers className="w-12 h-12 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="mb-2 text-2xl font-semibold">No Scene Selected</h3>
        <p className="max-w-md text-center text-muted-foreground">
          Select a scene from the timeline to start editing its properties
        </p>
      </div>
    );
  }

  const sceneIndex =
    state.scenes.findIndex((s) => s.id === selectedSceneToUse.id) + 1;

  // Get animation for selected static image
  const animationsForSelectedImage = selectedStaticImage
    ? animationHistory.filter((anim) => {
        const staticKey = extractS3Key(selectedStaticImage);
        const animationSourceKey = extractS3Key(anim.sourceImageUrl || "");

        return (
          anim.sourceImageUrl === selectedStaticImage ||
          (staticKey && animationSourceKey && staticKey === animationSourceKey)
        );
      })
    : [];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/5">
        {/* Compact Header */}
        <div className="p-4 border-b backdrop-blur-sm bg-background/80">
          <div className="flex justify-between items-center">
            <div className="flex gap-3 items-center">
              <div className="flex justify-center items-center w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Scene {sceneIndex}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedSceneToUse.elements.length} elements •{" "}
                  {selectedSceneToUse.duration}s
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Zap className="mr-1 w-3 h-3" />
              AI Enhanced
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* PRIORITY SECTION: Scene Display Mode */}
            <Card className="bg-gradient-to-br border-2 border-purple-200 dark:border-purple-800 from-purple-50/50 to-blue-50/50 dark:from-purple-950/30 dark:to-blue-950/30">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex gap-2 items-center text-xl">
                    <Layers className="w-5 h-5" />
                    Scene Display Mode
                  </CardTitle>
                  <div className="flex gap-2">
                    {selectedSceneToUse.imageUrl && (
                      <Badge variant="outline" className="text-xs">
                        {backgroundHistory.length} versions
                      </Badge>
                    )}
                    {selectedSceneToUse.videoUrl && (
                      <Badge variant="outline" className="text-xs">
                        Animated
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Preview */}
                <div className="flex gap-4 p-4 rounded-lg bg-background/50">
                  <div className="relative">
                    {currentSceneImageUrl ? (
                      <img
                        src={currentSceneImageUrl}
                        alt="Current scene"
                        className="object-cover w-24 h-36 rounded-lg shadow-md"
                      />
                    ) : (
                      <div className="flex justify-center items-center w-24 h-36 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg dark:from-gray-800 dark:to-gray-700">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {currentSceneVideoUrl && (
                      <div className="flex absolute inset-0 justify-center items-center rounded-lg bg-black/40">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-sm font-medium">Currently Using:</p>
                    <p className="text-lg font-semibold">
                      {useAnimatedVersion ? (
                        <span className="flex gap-2 items-center text-purple-600 dark:text-purple-400">
                          <Film className="w-4 h-4" />
                          Animated Version
                        </span>
                      ) : (
                        <span className="flex gap-2 items-center text-blue-600 dark:text-blue-400">
                          <FileImage className="w-4 h-4" />
                          Static Background
                        </span>
                      )}
                    </p>

                    {/* Prompt Display with Copy Functionality */}
                    {(() => {
                      const currentPrompt = getCurrentPrompt();
                      if (currentPrompt) {
                        return (
                          <div className="p-2 mt-2 rounded border bg-muted/30">
                            <div className="flex gap-2 items-start">
                              <div className="flex-1 min-w-0">
                                <p className="mb-1 text-xs font-medium text-muted-foreground">
                                  {currentPrompt.type === "animation"
                                    ? "Animation Prompt:"
                                    : "Image Prompt:"}
                                </p>
                                <p
                                  className="overflow-hidden text-xs leading-relaxed text-foreground"
                                  style={{
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                  }}
                                >
                                  {currentPrompt.text}
                                </p>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyToClipboard(
                                        currentPrompt.text,
                                        currentPrompt.type === "animation"
                                          ? "Animation prompt"
                                          : "Image prompt"
                                      )
                                    }
                                    className="flex-shrink-0 p-0 w-6 h-6 hover:bg-muted-foreground/10"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    Copy{" "}
                                    {currentPrompt.type === "animation"
                                      ? "animation"
                                      : "image"}{" "}
                                    prompt
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Mode Toggle Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={!useAnimatedVersion ? "default" : "outline"}
                    size="lg"
                    onClick={async () => {
                      console.log("[ScenePanel] Switching to Static mode:", {
                        sceneId: selectedSceneToUse.id,
                        preservingVideoUrl: !!selectedSceneToUse.videoUrl,
                        currentAnimationStatus:
                          selectedSceneToUse.animationStatus,
                      });

                      setUseAnimatedVersion(false);
                      if (selectedStaticImage && selectedSceneToUse?.id) {
                        const urlToUse =
                          refreshedSelectedStaticImage || selectedStaticImage;
                        console.log(
                          "[ScenePanel] Dispatching UPDATE_SCENE with useAnimatedVersion: false",
                          {
                            sceneId: selectedSceneToUse.id,
                            urlToUse,
                          }
                        );
                        dispatch({
                          type: "UPDATE_SCENE",
                          payload: {
                            sceneId: selectedSceneToUse.id,
                            updates: {
                              imageUrl: urlToUse,
                              // Keep videoUrl so we can switch back to animated
                              // videoUrl: preserving existing videoUrl
                              animationStatus: selectedSceneToUse.videoUrl
                                ? "completed"
                                : "none",
                              animate: false,
                              useAnimatedVersion: false,
                            },
                          },
                        });
                        updateSceneBackground(selectedSceneToUse.id, urlToUse);
                        toast({
                          title: "Switched to Static",
                          description: "Scene is now using static background",
                        });
                        // Manually trigger sync to database
                        await syncToDatabase();
                      }
                    }}
                    className={`h-16 ${!useAnimatedVersion ? "shadow-lg" : ""}`}
                    disabled={!selectedStaticImage}
                  >
                    <div className="flex flex-col gap-1 items-center">
                      <FileImage className="w-5 h-5" />
                      <span className="text-sm font-semibold">Use Static</span>
                    </div>
                  </Button>

                  <Button
                    variant={useAnimatedVersion ? "default" : "outline"}
                    size="lg"
                    onClick={async () => {
                      console.log("[ScenePanel] Switching to Animated mode:", {
                        sceneId: selectedSceneToUse.id,
                        hasVideoUrl: !!selectedSceneToUse?.videoUrl,
                        hasAnimationHistory:
                          animationsForSelectedImage.length > 0,
                        currentUseAnimated: useAnimatedVersion,
                        animationStatus: selectedSceneToUse.animationStatus,
                      });

                      if (!selectedStaticImage) {
                        toast({
                          title: "Select a background first",
                          description:
                            "Choose a static background before switching to animated mode",
                          variant: "destructive",
                        });
                        return;
                      }

                      const hasAnimation =
                        animationsForSelectedImage.length > 0;
                      const hasVideoUrl = !!selectedSceneToUse?.videoUrl;

                      if (hasAnimation) {
                        setUseAnimatedVersion(true);
                        const latestAnimation = animationsForSelectedImage[0];
                        if (selectedSceneToUse?.id) {
                          dispatch({
                            type: "UPDATE_SCENE",
                            payload: {
                              sceneId: selectedSceneToUse.id,
                              updates: {
                                imageUrl:
                                  refreshedSelectedStaticImage ||
                                  selectedStaticImage,
                                videoUrl: latestAnimation.videoUrl,
                                animationStatus: "completed",
                                animate: true,
                                animationPrompt:
                                  latestAnimation.animationPrompt,
                                useAnimatedVersion: true,
                              },
                            },
                          });
                          toast({
                            title: "Switched to Animated",
                            description: `Playing: "${latestAnimation.animationPrompt}"`,
                          });
                          // Manually trigger sync to database
                          await syncToDatabase();
                        }
                      } else if (hasVideoUrl) {
                        // Scene has a video URL but no animation history match
                        // This happens when animation was just generated
                        setUseAnimatedVersion(true);
                        if (selectedSceneToUse?.id) {
                          console.log(
                            "[ScenePanel] Dispatching UPDATE_SCENE with useAnimatedVersion: true",
                            {
                              sceneId: selectedSceneToUse.id,
                              currentVideoUrl: selectedSceneToUse.videoUrl,
                            }
                          );
                          dispatch({
                            type: "UPDATE_SCENE",
                            payload: {
                              sceneId: selectedSceneToUse.id,
                              updates: {
                                imageUrl:
                                  refreshedSelectedStaticImage ||
                                  selectedStaticImage,
                                videoUrl: selectedSceneToUse.videoUrl,
                                animationStatus: "completed",
                                animate: true,
                                animationPrompt:
                                  selectedSceneToUse.animationPrompt ||
                                  "Animation",
                                useAnimatedVersion: true,
                              },
                            },
                          });
                          toast({
                            title: "Switched to Animated",
                            description: "Using generated animation",
                          });
                          // Manually trigger sync to database
                          await syncToDatabase();
                        }
                      } else {
                        toast({
                          title: "No animation available",
                          description:
                            "Generate an animation for this background first",
                          variant: "destructive",
                        });
                      }
                    }}
                    className={`h-16 ${useAnimatedVersion ? "shadow-lg" : ""}`}
                    disabled={
                      !selectedStaticImage ||
                      (animationsForSelectedImage.length === 0 &&
                        !selectedSceneToUse?.videoUrl)
                    }
                  >
                    <div className="flex flex-col gap-1 items-center">
                      <Film className="w-5 h-5" />
                      <span className="text-sm font-semibold">
                        Use Animated
                      </span>
                    </div>
                  </Button>
                </div>

                {/* Background Selection */}
                {backgroundHistory.length > 0 && (
                  <div className="pt-4 space-y-3 border-t">
                    <Label className="flex gap-2 items-center text-sm font-medium">
                      <FileImage className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Select Background Version
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {backgroundHistory.slice(0, 6).map((item, index) => {
                        const refreshedItem =
                          refreshedBackgroundHistory[index] || item;
                        const isSelected =
                          selectedStaticImage === item.url ||
                          (selectedSceneToUse.imageUrl === item.url &&
                            !selectedStaticImage);

                        return (
                          <div
                            key={index}
                            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              isSelected
                                ? "border-blue-500 shadow-md scale-105"
                                : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                            onClick={async () => {
                              setSelectedStaticImage(item.url);
                              // Always update scene state when selecting a static image
                              if (selectedSceneToUse?.id) {
                                dispatch({
                                  type: "UPDATE_SCENE",
                                  payload: {
                                    sceneId: selectedSceneToUse.id,
                                    updates: {
                                      imageUrl: item.url,
                                      videoUrl: !useAnimatedVersion
                                        ? undefined
                                        : selectedSceneToUse.videoUrl,
                                      animationStatus: !useAnimatedVersion
                                        ? "none"
                                        : selectedSceneToUse.animationStatus,
                                      animate: useAnimatedVersion,
                                      useAnimatedVersion: useAnimatedVersion,
                                    },
                                  },
                                });
                                updateSceneBackground(
                                  selectedSceneToUse.id,
                                  item.url
                                );
                                // Manually trigger sync to database
                                await syncToDatabase();
                              }
                            }}
                          >
                            <img
                              src={refreshedItem.url}
                              alt={item.prompt}
                              className="object-cover w-full h-20"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t to-transparent from-black/60" />
                            <div className="absolute right-1 bottom-1 left-1">
                              <p className="text-[10px] text-white font-medium truncate">
                                {item.isOriginal ? "Original" : item.prompt}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle className="w-4 h-4 text-white drop-shadow-md" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Background Creation Tabs */}
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex gap-2 items-center">
                  <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Background Creator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="ai" className="w-full">
                  <TabsList className="grid grid-cols-2 mb-4 w-full">
                    <TabsTrigger value="ai" className="flex gap-2 items-center">
                      <Sparkles className="w-4 h-4" />
                      AI Background
                    </TabsTrigger>
                    <TabsTrigger
                      value="custom"
                      className="flex gap-2 items-center"
                    >
                      <Upload className="w-4 h-4" />
                      Custom
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="ai" className="space-y-4">
                    <div className="space-y-3">
                      <Label
                        htmlFor="flux-prompt"
                        className="text-sm font-medium"
                      >
                        {currentSceneImageUrl
                          ? "Edit Current Background"
                          : "Create New Background"}
                      </Label>
                      <Textarea
                        id="flux-prompt"
                        placeholder={
                          currentSceneImageUrl
                            ? "Describe how to modify... (e.g., 'Add sunset lighting', 'Make it cyberpunk')"
                            : "Describe your background... (e.g., 'Modern office space', 'Fantasy landscape')"
                        }
                        value={fluxPrompt}
                        onChange={(e) => setFluxPrompt(e.target.value)}
                        className="min-h-[80px] resize-none"
                      />

                      {/* Reference Images Section */}
                      {currentSceneImageUrl && (
                        <div className="pt-2 space-y-3 border-t">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium">
                              Reference Images ({additionalImages.length})
                            </Label>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setShowImageSelector(!showImageSelector)
                                }
                                className="text-xs"
                              >
                                <Image className="mr-1 w-3 h-3" />
                                From History
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  document
                                    .getElementById("additional-image-upload")
                                    ?.click()
                                }
                                className="text-xs"
                              >
                                <Upload className="mr-1 w-3 h-3" />
                                Upload
                              </Button>
                            </div>
                          </div>

                          {/* Additional Images Grid */}
                          {additionalImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {additionalImages.map((imageUrl, index) => {
                                const displayUrl =
                                  refreshedAdditionalImages[index] || imageUrl;
                                return (
                                  <div key={index} className="relative group">
                                    <img
                                      src={displayUrl}
                                      alt={`Reference ${index + 1}`}
                                      className="object-cover w-full h-16 rounded border"
                                    />
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        handleRemoveAdditionalImage(index)
                                      }
                                      className="absolute -top-1 -right-1 p-0 w-5 h-5 opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Background History Selector */}
                          {showImageSelector && (
                            <div className="p-3 rounded-lg border bg-muted/50">
                              <Label className="block mb-2 text-xs text-muted-foreground">
                                Select from background history:
                              </Label>
                              <div className="grid overflow-y-auto grid-cols-4 gap-2 max-h-32">
                                {backgroundHistory.map((item, index) => {
                                  const refreshedItem =
                                    refreshedBackgroundHistory[index] || item;
                                  return (
                                    <div
                                      key={index}
                                      className="relative cursor-pointer group"
                                      onClick={() =>
                                        handleAddFromBackgroundHistory(item.url)
                                      }
                                    >
                                      <img
                                        src={refreshedItem.url}
                                        alt={item.prompt}
                                        className="object-cover w-full h-12 rounded border transition-colors hover:border-blue-500"
                                      />
                                      <div className="absolute inset-0 rounded transition-colors bg-black/0 group-hover:bg-black/20" />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Hidden File Input */}
                          <input
                            type="file"
                            id="additional-image-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAdditionalImageUpload}
                          />

                          <p className="text-xs text-muted-foreground">
                            Add reference images to guide the AI editing process
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={() => handleFluxEdit()}
                        disabled={isFluxGenerating || !fluxPrompt.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        {isFluxGenerating ? (
                          <>
                            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                            {currentSceneImageUrl
                              ? "Editing..."
                              : "Generating..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 w-4 h-4" />
                            {currentSceneImageUrl
                              ? "Edit with AI"
                              : "Generate with AI"}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Alternative AI Options */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAIPrompt("background")}
                        className="flex-1"
                      >
                        <Mic className="mr-2 w-4 h-4" />
                        Classic AI Generator
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAIPrompt("scene")}
                        className="flex-1"
                      >
                        <Plus className="mr-2 w-4 h-4" />
                        Generate New Scenes
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="custom" className="space-y-4">
                    {/* Upload */}
                    <div>
                      <Label className="block mb-2 text-sm">Upload Image</Label>
                      <div
                        className="p-6 text-center rounded-lg border-2 border-dashed transition-colors cursor-pointer hover:border-muted-foreground/50"
                        onClick={() =>
                          document.getElementById("scene-bg-upload")?.click()
                        }
                      >
                        <Upload className="mx-auto mb-2 w-8 h-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Drop image or click to browse
                        </p>
                        <input
                          type="file"
                          id="scene-bg-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSceneImageUpload}
                        />
                      </div>
                    </div>

                    {/* Color Grid */}
                    <div>
                      <Label className="block mb-2 text-sm">Quick Colors</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { color: "#ffffff", name: "White" },
                          { color: "#000000", name: "Black" },
                          { color: "#3b82f6", name: "Blue" },
                          { color: "#10b981", name: "Green" },
                          { color: "#f59e0b", name: "Amber" },
                          { color: "#ef4444", name: "Red" },
                          { color: "#8b5cf6", name: "Purple" },
                          { color: "#6b7280", name: "Gray" },
                        ].map((bg) => (
                          <Tooltip key={bg.color}>
                            <TooltipTrigger asChild>
                              <button
                                className="rounded-lg border-2 transition-all aspect-square hover:scale-105"
                                style={{ backgroundColor: bg.color }}
                                onClick={() =>
                                  handleSetSceneBackground(bg.color)
                                }
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{bg.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>

                    {/* Custom Color Picker */}
                    <div>
                      <Label className="block mb-2 text-sm">Custom Color</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          className="w-12 h-12 rounded-lg border cursor-pointer"
                          onChange={(e) =>
                            handleSetSceneBackground(e.target.value)
                          }
                          title="Pick a custom color"
                        />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            Click to choose any color for your background
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Animation Generator - Clear and Prominent */}
            {selectedStaticImage && (
              <Card className="bg-gradient-to-br border-2 border-purple-500 dark:border-purple-700 from-purple-50/50 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/30">
                <CardHeader>
                  <CardTitle className="flex gap-2 items-center">
                    <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Create Animation from Selected Background
                  </CardTitle>
                  {animationsForSelectedImage.length > 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {animationsForSelectedImage.length} animation
                      {animationsForSelectedImage.length !== 1 ? "s" : ""}{" "}
                      available for this background
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Visual Flow Indicator */}
                  <div className="flex gap-3 items-center p-3 rounded-lg bg-purple-100/50 dark:bg-purple-900/20">
                    <img
                      src={refreshedSelectedStaticImage || selectedStaticImage}
                      alt="Selected"
                      className="object-cover w-12 h-12 rounded"
                    />
                    <ArrowRight className="w-4 h-4 text-purple-600" />
                    <div className="flex justify-center items-center w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded">
                      <Film className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-sm">
                      <p className="font-medium">Transform static → animated</p>
                      <p className="text-xs text-muted-foreground">
                        AI will add motion to your background
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Textarea
                        placeholder="Describe the animation effect... (e.g., 'Slow zoom in with parallax', 'Gentle swaying motion', 'Cinematic pan')"
                        value={localAnimationPrompt}
                        onChange={(e) =>
                          setLocalAnimationPrompt(e.target.value)
                        }
                        className="min-h-[80px] pr-12"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateAnimationPrompt}
                            disabled={
                              isGeneratingAnimationPrompt ||
                              !selectedStaticImage
                            }
                            className="absolute top-2 right-2 p-0 w-8 h-8 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                          >
                            {isGeneratingAnimationPrompt ? (
                              <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Generate animation prompt based on background</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Button
                      onClick={() => {
                        if (
                          selectedSceneToUse?.id &&
                          localAnimationPrompt &&
                          selectedStaticImage
                        ) {
                          dispatch({
                            type: "UPDATE_SCENE",
                            payload: {
                              sceneId: selectedSceneToUse.id,
                              updates: {
                                imageUrl:
                                  refreshedSelectedStaticImage ||
                                  selectedStaticImage,
                                animationPrompt: localAnimationPrompt,
                                animationStatus: "processing",
                                animate: true,
                              },
                            },
                          });
                          generateSceneAnimation(
                            selectedSceneToUse.id,
                            localAnimationPrompt
                          );
                          setTimeout(() => loadAnimationHistory(), 2000);
                        }
                      }}
                      disabled={isGenerating || !localAnimationPrompt.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          Creating Animation...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 w-4 h-4" />
                          Generate Animation
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Existing Animations for Selected Background */}
                  {animationsForSelectedImage.length > 0 && (
                    <div className="pt-4 space-y-2 border-t">
                      <Label className="text-sm font-medium">
                        Available Animations:
                      </Label>
                      <div className="space-y-2">
                        {animationsForSelectedImage.map((anim, index) => (
                          <div
                            key={index}
                            className="flex gap-3 items-center p-2 rounded-lg border cursor-pointer hover:bg-muted/50"
                            onClick={async () => {
                              if (selectedSceneToUse?.id) {
                                dispatch({
                                  type: "UPDATE_SCENE",
                                  payload: {
                                    sceneId: selectedSceneToUse.id,
                                    updates: {
                                      videoUrl: anim.videoUrl,
                                      animationPrompt: anim.animationPrompt,
                                      animationStatus: "completed",
                                      animate: true,
                                      useAnimatedVersion: true,
                                    },
                                  },
                                });
                                setUseAnimatedVersion(true);
                                toast({
                                  title: "Animation applied",
                                  description: `Using: "${anim.animationPrompt}"`,
                                });
                                // Manually trigger sync to database
                                await syncToDatabase();
                              }
                            }}
                          >
                            <Film className="w-4 h-4 text-purple-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {anim.animationPrompt}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(anim.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(anim.videoUrl, "_blank");
                              }}
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timing Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex gap-2 items-center text-lg">
                  <Clock className="w-4 h-4" />
                  Scene Duration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-4 text-center">
                  <div className="text-3xl font-bold">
                    {selectedSceneToUse.duration}s
                  </div>
                </div>
                <Slider
                  value={[selectedSceneToUse.duration]}
                  onValueChange={handleDurationChange}
                  min={1}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 5].map((duration) => (
                    <Button
                      key={duration}
                      variant="outline"
                      size="sm"
                      onClick={() => handleDurationChange([duration])}
                    >
                      {duration}s
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* AI Modal */}
        {isAIModalOpen && (
          <AIPromptModal
            isOpen={isAIModalOpen}
            onClose={() => setIsAIModalOpen(false)}
            onGenerate={handleAIGenerate}
            type={aiPromptType}
            forCurrentScene={true}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
