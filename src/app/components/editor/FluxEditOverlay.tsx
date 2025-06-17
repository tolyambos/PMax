"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Wand2, Sparkles, Loader2, X, Image, Palette, Zap } from "lucide-react";
import { useToast } from "@/app/components/ui/use-toast";

interface FluxEditOverlayProps {
  element: {
    id: string;
    type: string;
    content: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  isVisible: boolean;
  onClose: () => void;
  onUpdate: (updates: any) => void;
  sceneFormat?: "9:16" | "16:9" | "1:1" | "4:5";
}

export default function FluxEditOverlay({
  element,
  isVisible,
  onClose,
  onUpdate,
  sceneFormat = "9:16",
}: FluxEditOverlayProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [quickPrompts] = useState([
    "Add dramatic lighting",
    "Change to vintage style",
    "Make it more colorful",
    "Add bokeh background",
    "Convert to cyberpunk style",
    "Add golden hour lighting",
  ]);
  const { toast } = useToast();

  // Parse element content to get image URL
  const imageContent = element.content
    ? JSON.parse(element.content)
    : { src: "" };
  const currentImageUrl = imageContent.src || "";

  // Only show for image elements
  if (element.type !== "image" || !isVisible || !currentImageUrl) {
    return null;
  }

  const handleQuickEdit = (prompt: string) => {
    setEditPrompt(prompt);
  };

  const handleFluxEdit = async (promptToUse?: string) => {
    const finalPrompt = promptToUse || editPrompt;

    if (!finalPrompt.trim()) {
      toast({
        title: "Edit prompt required",
        description: "Please enter or select an edit instruction.",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);

    try {
      const response = await fetch("/api/ai/flux-kontext/edit-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceImageUrl: currentImageUrl,
          editPrompt: finalPrompt.trim(),
          format: sceneFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to edit image");
      }

      const result = await response.json();
      const editedImageUrl = result.data.imageURL;

      // Update element with new image
      onUpdate({
        content: JSON.stringify({
          ...imageContent,
          src: editedImageUrl,
        }),
      });

      toast({
        title: "Image edited successfully!",
        description: `Applied: "${finalPrompt.trim()}"`,
      });

      if (!promptToUse) {
        setEditPrompt("");
      }
    } catch (error) {
      console.error("Flux edit error:", error);
      toast({
        title: "Edit failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  // Calculate overlay position (above the element)
  const overlayStyle = {
    position: "absolute" as const,
    left: `${element.x}px`,
    top: `${Math.max(10, element.y - 180)}px`, // Position above element with minimum margin
    zIndex: 1000,
    width: `${Math.max(280, element.width || 280)}px`,
  };

  return (
    <div style={overlayStyle}>
      <Card className="border-2 border-purple-200 shadow-lg backdrop-blur-sm bg-white/95">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <div className="p-1 bg-purple-100 rounded">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <span className="text-sm font-medium">Flux Kontext</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  AI Editor
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="p-0 w-6 h-6"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>

          {/* Image Preview */}
          <div className="relative">
            <img
              src={currentImageUrl}
              alt="Selected element"
              className="object-cover w-full h-16 rounded border"
            />
            <Badge className="absolute top-1 right-1 text-xs text-white bg-black/60">
              <Image className="mr-1 w-3 h-3" />
              Selected
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Quick Edits
            </span>
            <div className="grid grid-cols-2 gap-1">
              {quickPrompts.slice(0, 4).map((prompt, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant="outline"
                  className="px-2 h-6 text-xs"
                  onClick={() => handleFluxEdit(prompt)}
                  disabled={isEditing}
                >
                  <Palette className="mr-1 w-3 h-3" />
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <div className="flex gap-1">
              <Input
                placeholder="Custom edit instruction..."
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isEditing) {
                    handleFluxEdit();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => handleFluxEdit()}
                disabled={isEditing || !editPrompt.trim()}
                className="px-3 h-8"
              >
                {isEditing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Status */}
          {isEditing && (
            <div className="flex gap-2 items-center text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Editing with Flux Kontext...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
