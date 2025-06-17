"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Slider } from "@/app/components/ui/slider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Music,
  Mic,
  Film,
  PenTool,
  Info,
  Lightbulb,
} from "lucide-react";
import { useVideoFormat, VIDEO_FORMATS } from "@/app/contexts/format-context";

interface AIPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (result: any) => void;
  type: "scene" | "voiceover" | "music" | "asset" | "background";
  forCurrentScene?: boolean;
  isRegenerating?: boolean;
  existingPrompt?: string;
}

// Format options with labels and dimensions from VIDEO_FORMATS
const formatOptions = [
  {
    value: "9:16",
    label: "Vertical (9:16)",
    subtitle: "Stories, TikTok",
    dimensions: `${VIDEO_FORMATS["9:16"].width}×${VIDEO_FORMATS["9:16"].height}`,
  },
  {
    value: "16:9",
    label: "Horizontal (16:9)",
    subtitle: "YouTube, Presentations",
    dimensions: `${VIDEO_FORMATS["16:9"].width}×${VIDEO_FORMATS["16:9"].height}`,
  },
  {
    value: "1:1",
    label: "Square (1:1)",
    subtitle: "Instagram, Profile",
    dimensions: `${VIDEO_FORMATS["1:1"].width}×${VIDEO_FORMATS["1:1"].height}`,
  },
  {
    value: "4:5",
    label: "Portrait (4:5)",
    subtitle: "Instagram",
    dimensions: `${VIDEO_FORMATS["4:5"].width}×${VIDEO_FORMATS["4:5"].height}`,
  },
];

// Style options with descriptions
const styleOptions = [
  {
    value: "realistic",
    label: "Realistic",
    description: "True-to-life images with high detail and natural lighting",
  },
  {
    value: "cinematic",
    label: "Cinematic",
    description: "Dramatic lighting, film-like quality with visual impact",
  },
  {
    value: "3D rendered",
    label: "3D Rendered",
    description: "Computer-generated 3D objects with depth and texture",
  },
  {
    value: "minimalist",
    label: "Minimalist",
    description: "Clean, simple design with limited colors and elements",
  },
  {
    value: "cartoon",
    label: "Cartoon",
    description:
      "Stylized, animated look with bold outlines and vibrant colors",
  },
  {
    value: "watercolor",
    label: "Watercolor",
    description: "Soft, artistic style with blended colors and subtle textures",
  },
];

export default function AIPromptModal({
  isOpen,
  onClose,
  onGenerate,
  type,
  forCurrentScene = false,
  isRegenerating = false,
  existingPrompt = "",
}: AIPromptModalProps) {
  const { currentFormat } = useVideoFormat();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [format, setFormat] = useState(currentFormat);
  const [numScenes, setNumScenes] = useState(3);
  const [style, setStyle] = useState("realistic");
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSuggestion, setPromptSuggestion] = useState<string>("");
  const { toast } = useToast();

  // Update format when currentFormat changes
  useEffect(() => {
    setFormat(currentFormat);
  }, [currentFormat]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // If regenerating, use the existing prompt as a starting point
      if (isRegenerating && existingPrompt) {
        setPrompt(existingPrompt);
      }
      setPromptError(null);
      setIsGenerating(false);
      // For regeneration, always generate just 1 scene
      if (isRegenerating) {
        setNumScenes(1);
      }
      // Use current project format
      setFormat(currentFormat);
    }
  }, [isOpen, isRegenerating, existingPrompt, currentFormat]);

  // Generate prompt suggestions based on selected type
  useEffect(() => {
    if (type === "scene") {
      setPromptSuggestion(
        "A luxury product showcase with dramatic lighting and reflections"
      );
    } else if (type === "background") {
      setPromptSuggestion(
        "Soft gradient with subtle geometric patterns in blue and purple"
      );
    } else if (type === "asset") {
      setPromptSuggestion(
        "A 3D rendered smartphone floating in space with a glowing screen"
      );
    } else if (type === "voiceover") {
      setPromptSuggestion(
        "Welcome to our latest collection. Discover innovation reimagined."
      );
    } else if (type === "music") {
      setPromptSuggestion(
        "Upbeat corporate track with motivational energy and light percussion"
      );
    }
  }, [type]);

  const handleInsertSuggestion = () => {
    setPrompt(promptSuggestion);
    setPromptError(null);
  };

  const validatePrompt = () => {
    if (!prompt.trim()) {
      setPromptError("Please enter a prompt");
      return false;
    }

    if (prompt.length < 5) {
      setPromptError("Your prompt is too short for good results");
      return false;
    }

    setPromptError(null);
    return true;
  };

  const handleGenerate = async () => {
    if (!validatePrompt()) return;

    setIsGenerating(true);

    try {
      if (type === "scene") {
        // Enhance the prompt with style if selected
        let enhancedPrompt = prompt;
        if (style !== "realistic") {
          enhancedPrompt = `${prompt} (in ${style} style)`;
        }

        // Call our API endpoint for scene generation
        const response = await fetch("/api/ai/generate-scenes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            format,
            numScenes,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate scenes");
        }

        const data = await response.json();

        if (!data.scenes || data.scenes.length === 0) {
          throw new Error("No scenes were generated");
        }

        onGenerate(data.scenes);

        toast({
          title: "Scenes generated",
          description: `Created ${data.scenes.length} scenes based on your prompt.`,
        });
      } else if (type === "background") {
        // For background, we use the Runware API via our new API endpoint
        console.log("Generating background image for scene");
        let enhancedPrompt = prompt;
        if (style !== "realistic") {
          enhancedPrompt = `${prompt} (in ${style} style)`;
        }

        // Call our API endpoint for background generation
        const response = await fetch("/api/ai/generate-background", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            format: format,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate background");
        }

        const data = await response.json();

        if (!data.background || !data.background.imageUrl) {
          throw new Error("No background was generated");
        }

        // Create a background asset object
        const timestamp = Date.now();
        const backgroundAsset = {
          id: `bg-${timestamp}`,
          name: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
          type: "background",
          url: data.background.imageUrl,
          thumbnail: data.background.imageUrl,
          tags: "AI generated background",
          createdAt: new Date(),
          isBackground: true,
        };

        // Return just the one background image
        onGenerate(backgroundAsset);

        toast({
          title: "Background Generated",
          description: "Created a background image for the current scene",
        });
      } else if (type === "asset") {
        // Enhance the prompt with style if selected
        let enhancedPrompt = prompt;
        if (style !== "realistic") {
          enhancedPrompt = `${prompt} (in ${style} style)`;
        }

        // For demonstration purposes - in a real app you'd call an AI image generation API
        // Using realistic demo images to show functionality
        const timestamp = Date.now();

        // Use a set of realistic placeholder images with descriptive names
        const demoImages = [
          {
            url: "https://images.unsplash.com/photo-1533134486753-c833f0ed4866?q=80&w=600&h=400&fit=crop",
            desc: "Digital devices on desk",
          },
          {
            url: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=600&h=400&fit=crop",
            desc: "Futuristic technology",
          },
          {
            url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&h=400&fit=crop",
            desc: "Apple MacBook on desk",
          },
          {
            url: "https://images.unsplash.com/photo-1626908013351-800ddd7b196c?q=80&w=600&h=400&fit=crop",
            desc: "Abstract digital art",
          },
          {
            url: "https://images.unsplash.com/photo-1647427060118-4911c9821b82?q=80&w=600&h=400&fit=crop",
            desc: "Smart home device",
          },
        ];

        // Choose a random image from the demo images
        const randomIndex = Math.floor(Math.random() * demoImages.length);
        const imageUrl = demoImages[randomIndex].url;
        const imageDesc = demoImages[randomIndex].desc;

        // Create an asset
        const mockAsset = {
          id: `asset-${timestamp}`,
          name: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
          type: "image",
          url: imageUrl,
          thumbnail: imageUrl,
          tags: imageDesc,
          createdAt: new Date(),
          forCurrentScene: forCurrentScene,
        };

        // Short timeout to simulate generation process
        setTimeout(() => {
          onGenerate(mockAsset);

          toast({
            title: "Asset generated",
            description: forCurrentScene
              ? "AI has created an asset for your current scene."
              : "AI has created a new asset for your library.",
          });
        }, 2000);
      } else if (type === "voiceover") {
        // Call our API endpoint for voiceover generation
        const response = await fetch("/api/ai/generate-voiceover", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: prompt,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate voiceover");
        }

        const data = await response.json();
        onGenerate(data);

        toast({
          title: "Voiceover generated",
          description: "Your AI voiceover is ready to use.",
        });
      } else if (type === "music") {
        // Mock music generation for now
        setTimeout(() => {
          const mockMusic = {
            id: `music-${Date.now()}`,
            name: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
            type: "audio",
            url: "https://example.com/audio/music-sample.mp3", // Mock URL
            thumbnail:
              "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop",
            tags: "AI generated music",
            createdAt: new Date(),
          };

          onGenerate(mockMusic);

          toast({
            title: "Music generated",
            description: "AI has created a music track based on your prompt.",
          });
        }, 2000);
      }
    } catch (error: any) {
      console.error(`Error generating ${type}:`, error);
      toast({
        variant: "destructive",
        title: `Generation failed`,
        description:
          error.message ||
          `There was an error generating your ${type}. Please try again.`,
      });
    } finally {
      setIsGenerating(false);
      onClose();
    }
  };

  const getTitle = () => {
    if (isRegenerating) {
      return "Regenerate Scene with AI";
    }

    switch (type) {
      case "scene":
        return "Generate Scene with AI";
      case "voiceover":
        return "Generate AI Voiceover";
      case "music":
        return "Generate Music with AI";
      case "asset":
        return forCurrentScene
          ? "Generate Asset for Current Scene"
          : "Generate Asset with AI";
      case "background":
        return "Generate Image for Scene Background";
      default:
        return "Generate with AI";
    }
  };

  const getDescription = () => {
    if (isRegenerating) {
      return "Modify the prompt below to regenerate the scene with different content. The existing prompt is shown as a starting point.";
    }

    switch (type) {
      case "scene":
        return "Describe what you want in your scenes and we'll create them for you";
      case "voiceover":
        return "Enter the script for your voiceover";
      case "music":
        return "Describe the mood and style of music you need";
      case "asset":
        return forCurrentScene
          ? "Create a new visual element for your current scene"
          : "Generate an image asset to use in your project";
      case "background":
        return "Design a background image for your scene";
      default:
        return "Use AI to generate content for your project";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "scene":
        return <Film className="w-5 h-5 text-primary" />;
      case "voiceover":
        return <Mic className="w-5 h-5 text-primary" />;
      case "music":
        return <Music className="w-5 h-5 text-primary" />;
      case "asset":
        return <ImageIcon className="w-5 h-5 text-primary" />;
      case "background":
        return <PenTool className="w-5 h-5 text-primary" />;
      default:
        return <Sparkles className="w-5 h-5 text-primary" />;
    }
  };

  const getPlaceholder = () => {
    switch (type) {
      case "scene":
        return "Describe the scene you want to generate... (e.g. 'A luxury watch on a dark background with soft lighting and reflections')";
      case "voiceover":
        return "Enter the text for the voiceover...";
      case "music":
        return "Describe the music mood or style you want... (e.g. 'Upbeat corporate background music with positive energy')";
      case "asset":
        return "Describe the asset you want to generate... (e.g. 'A 3D render of a modern smartphone with transparent background')";
      case "background":
        return "Describe exactly what you want to see... (e.g. 'Luxury watch on marble table with soft golden lighting')";
      default:
        return "Enter your prompt...";
    }
  };

  const getPromptTips = () => {
    switch (type) {
      case "scene":
        return "For best results, include details about lighting, perspective, mood, and colors.";
      case "background":
        return "Describing the composition, colors, and texture will yield the best backgrounds.";
      case "asset":
        return "Specify if you want transparent backgrounds, what angle to show the object from, and lighting details.";
      case "voiceover":
        return "For best results, use proper punctuation to control pacing and intonation.";
      case "music":
        return "Specify mood, tempo, instruments, and cultural influences for more tailored results.";
      default:
        return "Be specific and detailed in your prompt for better results.";
    }
  };

  // Determine if we should show style & format options based on type
  const showStyleOptions = ["scene", "asset", "background"].includes(type);
  const showFormatOptions = ["scene", "background"].includes(type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="prompt" className="flex gap-2 items-center">
                Your Prompt
                <Info className="w-4 h-4 cursor-help text-muted-foreground" />
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInsertSuggestion}
                className="flex gap-1 items-center px-2 py-1 h-auto text-xs"
              >
                <Lightbulb className="w-3 h-3" />
                Insert Example
              </Button>
            </div>

            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (promptError) validatePrompt();
              }}
              className={`w-full min-h-[120px] resize-y ${promptError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              placeholder={getPlaceholder()}
              rows={4}
            />

            {promptError && (
              <p className="text-xs text-destructive">{promptError}</p>
            )}

            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">{getPromptTips()}</p>
              <p className="text-xs text-muted-foreground">
                {prompt.length} / 1000 characters
              </p>
            </div>
          </div>

          {(showStyleOptions || showFormatOptions) && (
            <Tabs
              defaultValue={showFormatOptions ? "format" : "style"}
              className="w-full"
            >
              <TabsList
                className="grid w-full"
                style={{
                  gridTemplateColumns:
                    showFormatOptions && showStyleOptions
                      ? type === "scene"
                        ? "repeat(3, 1fr)"
                        : "repeat(2, 1fr)"
                      : "1fr",
                }}
              >
                {showFormatOptions && (
                  <TabsTrigger value="format">Format</TabsTrigger>
                )}
                {showStyleOptions && (
                  <TabsTrigger value="style">Style</TabsTrigger>
                )}
                {type === "scene" && (
                  <TabsTrigger value="scenes">Scenes</TabsTrigger>
                )}
              </TabsList>

              {showFormatOptions && (
                <TabsContent value="format" className="py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {formatOptions.map((option) => (
                      <div
                        key={option.value}
                        className={`
                          flex flex-col items-center justify-center p-3 border rounded-md cursor-pointer 
                          hover:border-primary/50 hover:bg-accent transition-colors
                          ${format === option.value ? "border-primary bg-accent/50" : "border-border"}
                        `}
                        onClick={() =>
                          setFormat(
                            option.value as "9:16" | "16:9" | "1:1" | "4:5"
                          )
                        }
                      >
                        <div
                          className={`
                            bg-muted 
                            ${
                              option.value === "9:16"
                                ? "w-8 h-14"
                                : option.value === "16:9"
                                  ? "w-14 h-8"
                                  : option.value === "1:1"
                                    ? "w-10 h-10"
                                    : "w-9 h-11"
                            }
                            rounded border border-border
                          `}
                        />
                        <div className="mt-2 text-center">
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.subtitle}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}

              {showStyleOptions && (
                <TabsContent value="style" className="py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {styleOptions.map((styleOption) => (
                      <div
                        key={styleOption.value}
                        className={`
                          flex flex-col p-3 border rounded-md cursor-pointer
                          hover:border-primary/50 hover:bg-accent transition-colors
                          ${style === styleOption.value ? "border-primary bg-accent/50" : "border-border"}
                        `}
                        onClick={() => setStyle(styleOption.value)}
                      >
                        <span className="text-sm font-medium">
                          {styleOption.label}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {styleOption.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}

              {type === "scene" && (
                <TabsContent value="scenes" className="py-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="numScenes">
                        {isRegenerating
                          ? "Regenerating 1 scene"
                          : "Number of scenes to generate"}
                      </Label>
                      <span className="text-sm font-medium">{numScenes}</span>
                    </div>
                    {!isRegenerating && (
                      <>
                        <Slider
                          id="numScenes"
                          min={1}
                          max={5}
                          step={1}
                          value={[numScenes]}
                          onValueChange={(value) => setNumScenes(value[0])}
                          className="py-4"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1</span>
                          <span>2</span>
                          <span>3</span>
                          <span>4</span>
                          <span>5</span>
                        </div>
                      </>
                    )}
                    {isRegenerating && (
                      <div className="p-3 text-xs rounded-md border bg-muted/30">
                        This will replace the current scene with a new
                        AI-generated version based on your prompt.
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>

        <DialogFooter className="pt-4 mt-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="min-w-[120px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                {isRegenerating ? "Regenerating..." : "Generating..."}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 w-4 h-4" />
                {isRegenerating ? "Regenerate" : "Generate"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
