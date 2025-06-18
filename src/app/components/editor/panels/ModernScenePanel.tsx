"use client";

import { useState, useEffect } from "react";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import { useToast } from "@/app/components/ui/use-toast";
import {
  Sparkles,
  Image,
  Wand2,
  Play,
  Pause,
  RotateCw,
  Upload,
  Palette,
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
} from "lucide-react";
import { useEditor } from "../context/editor-context";
import { useVideoFormat } from "@/app/contexts/format-context";

interface ScenePanelProps {
  toast: {
    (props: {
      title: string;
      description?: string;
      variant?: "default" | "destructive";
    }): void;
  };
}

export default function ModernScenePanel({ toast }: ScenePanelProps) {
  const { state, dispatch } = useEditor();
  const { currentFormat } = useVideoFormat();
  const [fluxPrompt, setFluxPrompt] = useState("");
  const [isFluxGenerating, setIsFluxGenerating] = useState(false);
  const [backgroundHistory, setBackgroundHistory] = useState<
    Array<{
      url: string;
      prompt: string;
      timestamp: number;
    }>
  >([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedScene = state.selectedSceneId
    ? state.scenes.find((scene) => scene.id === state.selectedSceneId)
    : null;

  const quickPrompts = [
    {
      icon: "🌅",
      text: "Add sunset lighting",
      color: "from-orange-400 to-pink-500",
    },
    {
      icon: "🌃",
      text: "Cyberpunk cityscape",
      color: "from-purple-500 to-blue-600",
    },
    {
      icon: "🏔️",
      text: "Mountain landscape",
      color: "from-green-400 to-blue-500",
    },
    {
      icon: "🎨",
      text: "Abstract art style",
      color: "from-pink-500 to-violet-600",
    },
    {
      icon: "⚡",
      text: "Dramatic lighting",
      color: "from-yellow-400 to-orange-500",
    },
    { icon: "🌊", text: "Ocean waves", color: "from-blue-400 to-cyan-500" },
  ];

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

    setIsFluxGenerating(true);

    try {
      const endpoint = selectedScene?.imageUrl
        ? "/api/ai/flux-kontext/edit-image"
        : "/api/ai/generate-background";

      const requestBody = selectedScene?.imageUrl
        ? {
            referenceImageUrl: selectedScene.imageUrl,
            editPrompt: finalPrompt,
            format: currentFormat,
          }
        : {
            prompt: finalPrompt,
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

      // Update scene background
      if (selectedScene) {
        dispatch({
          type: "UPDATE_SCENE",
          payload: {
            sceneId: selectedScene.id,
            updates: {
              imageUrl: newImageUrl,
              backgroundColor: undefined,
            },
          },
        });

        // Add to history
        setBackgroundHistory((prev) => [
          ...prev,
          {
            url: newImageUrl,
            prompt: finalPrompt,
            timestamp: Date.now(),
          },
        ]);

        toast({
          title: selectedScene.imageUrl
            ? "Background edited!"
            : "Background generated!",
          description: `Applied: "${finalPrompt}"`,
        });

        if (!promptToUse) {
          setFluxPrompt("");
        }
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
    if (selectedScene) {
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedScene.id,
          updates: { duration: value[0] },
        },
      });
    }
  };

  const handleColorBackground = (color: string) => {
    if (selectedScene) {
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedScene.id,
          updates: {
            backgroundColor: color,
            imageUrl: undefined,
          },
        },
      });
    }
  };

  const restoreBackground = (historyItem: (typeof backgroundHistory)[0]) => {
    if (selectedScene) {
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedScene.id,
          updates: {
            imageUrl: historyItem.url,
            backgroundColor: undefined,
          },
        },
      });

      toast({
        title: "Background restored",
        description: `Restored: "${historyItem.prompt}"`,
      });
    }
  };

  if (!selectedScene) {
    return (
      <div className="p-6 space-y-4 text-center">
        <div className="flex justify-center items-center mx-auto w-16 h-16 rounded-full bg-muted">
          <Eye className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium text-muted-foreground">
            No Scene Selected
          </h3>
          <p className="text-sm text-muted-foreground">
            Select a scene to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Scene Header */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <div className="flex justify-center items-center w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">Scene Editor</h2>
              <p className="text-xs text-muted-foreground">
                Scene{" "}
                {state.scenes.findIndex((s) => s.id === selectedScene.id) + 1}{" "}
                of {state.scenes.length}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm font-medium">
            {selectedScene.duration}s
          </Badge>
        </div>

        {/* Scene Preview */}
        <Card className="overflow-hidden">
          <div className="relative aspect-[9/16] bg-gradient-to-br from-gray-100 to-gray-200">
            {selectedScene.imageUrl ? (
              <img
                src={selectedScene.imageUrl}
                alt="Scene background"
                className="object-cover w-full h-full"
              />
            ) : selectedScene.backgroundColor ? (
              <div
                className="w-full h-full"
                style={{ backgroundColor: selectedScene.backgroundColor }}
              />
            ) : (
              <div className="flex justify-center items-center w-full h-full">
                <div className="space-y-2 text-center">
                  <Image className="mx-auto w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No background</p>
                </div>
              </div>
            )}

            {/* Elements overlay count */}
            {selectedScene.elements.length > 0 && (
              <Badge className="absolute top-2 right-2 text-white bg-black/60">
                {selectedScene.elements.length} element
                {selectedScene.elements.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* AI Background Editor - Main Feature */}
      <Card className="from-purple-200 to-blue-200 border-2 border-gradient-to-r">
        <CardHeader className="pb-3">
          <CardTitle className="flex gap-2 items-center text-lg">
            <div className="flex justify-center items-center w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Flux Kontext AI Editor
            <Badge variant="secondary" className="ml-auto">
              Pro
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Prompts */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Styles</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className={`h-12 bg-gradient-to-r ${prompt.color} text-white border-0 hover:opacity-90`}
                  onClick={() => handleFluxEdit(prompt.text)}
                  disabled={isFluxGenerating}
                >
                  <span className="mr-2 text-lg">{prompt.icon}</span>
                  <span className="text-xs font-medium">{prompt.text}</span>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Prompt */}
          <div className="space-y-3">
            <Label htmlFor="flux-prompt" className="text-sm font-medium">
              {selectedScene.imageUrl
                ? "Edit Current Background"
                : "Create New Background"}
            </Label>
            <Textarea
              id="flux-prompt"
              placeholder={
                selectedScene.imageUrl
                  ? "Describe how to modify the background... (e.g., 'Add dramatic storm clouds', 'Change to night time', 'Make it more colorful')"
                  : "Describe your ideal background... (e.g., 'Futuristic city at sunset', 'Peaceful forest clearing', 'Abstract geometric patterns')"
              }
              value={fluxPrompt}
              onChange={(e) => setFluxPrompt(e.target.value)}
              className="min-h-[80px] resize-none"
            />

            <Button
              onClick={() => handleFluxEdit()}
              disabled={isFluxGenerating || !fluxPrompt.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="lg"
            >
              {isFluxGenerating ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  {selectedScene.imageUrl ? "Editing..." : "Generating..."}
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 w-4 h-4" />
                  {selectedScene.imageUrl
                    ? "Edit Background"
                    : "Generate Background"}
                </>
              )}
            </Button>
          </div>

          {/* Background History */}
          {backgroundHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="flex gap-2 items-center text-sm font-medium">
                  <RotateCw className="w-4 h-4" />
                  Recent Versions ({backgroundHistory.length})
                </Label>
                <div className="grid overflow-y-auto grid-cols-2 gap-2 max-h-32">
                  {backgroundHistory
                    .slice(-4)
                    .reverse()
                    .map((item, index) => (
                      <Card
                        key={index}
                        className="p-2 cursor-pointer hover:bg-muted/50"
                        onClick={() => restoreBackground(item)}
                      >
                        <div className="flex gap-2">
                          <img
                            src={item.url}
                            alt={`Version ${index + 1}`}
                            className="object-cover w-12 h-12 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {item.prompt}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-0 mt-1 h-5 text-xs"
                            >
                              <Download className="mr-1 w-3 h-3" />
                              Use
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Scene Properties */}
      <Accordion type="single" collapsible className="space-y-2">
        {/* Duration Settings */}
        <AccordionItem value="duration" className="px-4 rounded-lg border">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex gap-2 items-center">
              <Clock className="w-4 h-4" />
              <span>Duration & Timing</span>
              <Badge variant="outline" className="mr-2 ml-auto text-sm font-medium">
                {selectedScene.duration}s
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Scene Duration</Label>
              <div className="px-3">
                <Slider
                  value={[selectedScene.duration]}
                  onValueChange={handleDurationChange}
                  min={1}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>1s</span>
                <span>{selectedScene.duration}s</span>
                <span>10s</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Color Backgrounds */}
        <AccordionItem value="colors" className="px-4 rounded-lg border">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex gap-2 items-center">
              <Palette className="w-4 h-4" />
              <span>Solid Colors</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { color: "#ffffff", name: "White" },
                { color: "#000000", name: "Black" },
                { color: "#3b82f6", name: "Blue" },
                { color: "#10b981", name: "Green" },
                { color: "#f59e0b", name: "Yellow" },
                { color: "#ef4444", name: "Red" },
                { color: "#8b5cf6", name: "Purple" },
                { color: "#6b7280", name: "Gray" },
              ].map((bg) => (
                <button
                  key={bg.color}
                  className="rounded-lg border-2 transition-transform aspect-square hover:scale-105"
                  style={{ backgroundColor: bg.color }}
                  onClick={() => handleColorBackground(bg.color)}
                  title={bg.name}
                />
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Custom Color</Label>
              <Input
                type="color"
                value={selectedScene.backgroundColor || "#ffffff"}
                onChange={(e) => handleColorBackground(e.target.value)}
                className="w-full h-10"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Animation Settings */}
        <AccordionItem value="animation" className="px-4 rounded-lg border">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex gap-2 items-center">
              <Film className="w-4 h-4" />
              <span>Animation</span>
              {selectedScene.animationStatus &&
                selectedScene.animationStatus !== "none" && (
                  <Badge
                    variant={
                      selectedScene.animationStatus === "completed"
                        ? "default"
                        : "secondary"
                    }
                    className="mr-2 ml-auto"
                  >
                    {selectedScene.animationStatus === "completed" && (
                      <CheckCircle className="mr-1 w-3 h-3" />
                    )}
                    {selectedScene.animationStatus === "processing" && (
                      <Loader2 className="mr-1 w-3 h-3 animate-spin" />
                    )}
                    {selectedScene.animationStatus === "failed" && (
                      <AlertCircle className="mr-1 w-3 h-3" />
                    )}
                    {selectedScene.animationStatus}
                  </Badge>
                )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm">Enable Animation</Label>
              <Switch
                checked={
                  selectedScene.animationStatus !== "none" &&
                  selectedScene.animationStatus !== undefined
                }
                onCheckedChange={(checked) => {
                  dispatch({
                    type: "UPDATE_SCENE",
                    payload: {
                      sceneId: selectedScene.id,
                      updates: {
                        animationStatus: checked ? "ready" : "none",
                        animate: checked,
                      },
                    },
                  });
                }}
              />
            </div>

            {selectedScene.animationStatus !== "none" &&
              selectedScene.animationStatus !== undefined && (
                <div className="space-y-2">
                  <Label className="text-sm">Animation Prompt</Label>
                  <Textarea
                    placeholder="Describe the animation... (e.g., 'Gentle camera zoom', 'Parallax effect', 'Subtle movement')"
                    value={selectedScene.animationPrompt || ""}
                    onChange={(e) => {
                      dispatch({
                        type: "UPDATE_SCENE",
                        payload: {
                          sceneId: selectedScene.id,
                          updates: { animationPrompt: e.target.value },
                        },
                      });
                    }}
                    className="min-h-[60px] resize-none"
                  />
                </div>
              )}
          </AccordionContent>
        </AccordionItem>

        {/* Advanced Settings */}
        <AccordionItem value="advanced" className="px-4 rounded-lg border">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex gap-2 items-center">
              <Settings className="w-4 h-4" />
              <span>Advanced Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Scene ID
                </Label>
                <p className="font-mono">
                  {selectedScene.id.substring(0, 8)}...
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Elements
                </Label>
                <p>{selectedScene.elements.length} elements</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Background Type
                </Label>
                <p>
                  {selectedScene.imageUrl
                    ? "Image"
                    : selectedScene.backgroundColor
                      ? "Color"
                      : "None"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Order</Label>
                <p>Position {selectedScene.order + 1}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
