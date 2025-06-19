"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
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
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent } from "@/app/components/ui/card";
import { Separator } from "@/app/components/ui/separator";
import { S3AssetMemoized } from "@/components/S3Asset";
import {
  RotateCcw,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Clock,
  Palette,
  Wand2,
} from "lucide-react";

interface SceneRegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (params: {
    prompt: string;
    style: string;
    duration: number;
  }) => void;
  scene: {
    id: string;
    imageUrl?: string;
    prompt?: string;
    duration: number;
    style?: string;
  };
  sceneIndex: number;
  isGenerating?: boolean;
}

const STYLE_OPTIONS = [
  {
    value: "realistic",
    label: "Realistic",
    description: "Natural, photographic style",
  },
  {
    value: "cinematic",
    label: "Cinematic",
    description: "Dramatic, film-like quality",
  },
  {
    value: "minimalist",
    label: "Minimalist",
    description: "Clean, simple aesthetic",
  },
  { value: "vibrant", label: "Vibrant", description: "Bold, colorful energy" },
  {
    value: "3D rendered",
    label: "3D Rendered",
    description: "Photorealistic 3D graphics",
  },
];

export default function SceneRegenerateModal({
  isOpen,
  onClose,
  onRegenerate,
  scene,
  sceneIndex,
  isGenerating = false,
}: SceneRegenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [duration, setDuration] = useState(3);

  // Initialize form with current scene data
  useEffect(() => {
    if (scene) {
      setPrompt(scene.prompt || "");
      setStyle(scene.style || "realistic");
      setDuration(scene.duration || 3);
    }
  }, [scene]);

  const handleRegenerate = () => {
    onRegenerate({
      prompt,
      style,
      duration,
    });
  };

  const selectedStyleInfo = STYLE_OPTIONS.find((opt) => opt.value === style);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <RotateCcw className="w-5 h-5" />
            Regenerate Scene {sceneIndex}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Scene Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3 items-center mb-3">
                <div className="flex justify-center items-center w-8 h-8 rounded-lg bg-primary/10">
                  <ImageIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Current Scene</h3>
                  <p className="text-sm text-muted-foreground">
                    This will be replaced
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                {/* Scene Image */}
                <div className="overflow-hidden flex-shrink-0 w-32 h-20 rounded-lg bg-muted">
                  {scene.imageUrl ? (
                    <S3AssetMemoized
                      url={scene.imageUrl}
                      alt={`Scene ${sceneIndex}`}
                      width={128}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="flex justify-center items-center w-full h-full text-muted-foreground">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Scene Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Badge variant="outline" className="text-xs">
                      <Clock className="mr-1 w-3 h-3" />
                      {scene.duration}s
                    </Badge>
                    {scene.style && (
                      <Badge variant="outline" className="text-xs">
                        <Palette className="mr-1 w-3 h-3" />
                        {scene.style}
                      </Badge>
                    )}
                  </div>
                  {scene.prompt && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {scene.prompt}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Regeneration Settings */}
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <Wand2 className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Regeneration Settings</h3>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="prompt">Scene Description</Label>
                <span
                  className={`text-xs ${prompt.length > 1500 ? "text-orange-500" : "text-muted-foreground"}`}
                >
                  {prompt.length}/1500
                </span>
              </div>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to see in this scene..."
                className="min-h-[100px]"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Be very specific about what you want to see, lighting,
                composition, mood, and details.
                {prompt.length > 1500 && (
                  <span className="block text-orange-500">
                    💡 Very long prompts may be optimized for better generation.
                  </span>
                )}
              </p>
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <Label htmlFor="style">Visual Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStyleInfo && (
                <p className="text-xs text-muted-foreground">
                  {selectedStyleInfo.description}
                </p>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration: {duration}s</Label>
              <Slider
                id="duration"
                min={1}
                max={5}
                step={1}
                value={[duration]}
                onValueChange={(value) => setDuration(value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1s</span>
                <span>5s</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={isGenerating || !prompt.trim()}
            className="min-w-[120px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 w-4 h-4" />
                Regenerate Scene
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
