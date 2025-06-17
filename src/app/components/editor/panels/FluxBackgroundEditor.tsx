/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Wand2,
  Sparkles,
  Loader2,
  Image,
  RotateCw,
  Download,
  AlertTriangle,
} from "lucide-react";

interface FluxBackgroundEditorProps {
  currentImageUrl?: string;
  sceneFormat?: "9:16" | "16:9" | "1:1" | "4:5";
  onBackgroundUpdate: (imageUrl: string) => void;
  toast: (props: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

export default function FluxBackgroundEditor({
  currentImageUrl,
  sceneFormat = "9:16",
  onBackgroundUpdate,
  toast,
}: FluxBackgroundEditorProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editHistory, setEditHistory] = useState<
    Array<{ url: string; prompt: string; type: "edit" | "generate" }>
  >([]);

  const handleFluxEdit = async () => {
    if (!editPrompt.trim()) {
      toast({
        title: "Edit prompt required",
        description: "Please describe how you'd like to edit the background.",
        variant: "destructive",
      });
      return;
    }

    if (!currentImageUrl) {
      toast({
        title: "No background to edit",
        description:
          "Upload a background image first or generate one from scratch.",
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
          editPrompt: editPrompt.trim(),
          format: sceneFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to edit background");
      }

      const result = await response.json();
      const editedImageUrl = result.data.imageURL;

      // Save to history
      setEditHistory((prev) => [
        ...prev,
        {
          url: editedImageUrl,
          prompt: editPrompt.trim(),
          type: "edit",
        },
      ]);

      // Update background
      onBackgroundUpdate(editedImageUrl);

      toast({
        title: "Background edited successfully!",
        description: `Applied: "${editPrompt.trim()}"`,
      });

      setEditPrompt("");
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

  const handleFluxGenerate = async () => {
    if (!editPrompt.trim()) {
      toast({
        title: "Generation prompt required",
        description: "Please describe the background you'd like to generate.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Use the existing AI generation system but with enhanced prompts for Flux
      const response = await fetch("/api/ai/generate-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `High-quality, professional background: ${editPrompt.trim()}`,
          format: sceneFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to generate background");
      }

      const result = await response.json();
      const generatedImageUrl = result.data.imageUrl;

      // Save to history
      setEditHistory((prev) => [
        ...prev,
        {
          url: generatedImageUrl,
          prompt: editPrompt.trim(),
          type: "generate",
        },
      ]);

      // Update background
      onBackgroundUpdate(generatedImageUrl);

      toast({
        title: "Background generated successfully!",
        description: `Created: "${editPrompt.trim()}"`,
      });

      setEditPrompt("");
    } catch (error) {
      console.error("Flux generation error:", error);
      toast({
        title: "Generation failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const restoreFromHistory = (historyItem: {
    url: string;
    prompt: string;
    type: "edit" | "generate";
  }) => {
    onBackgroundUpdate(historyItem.url);
    toast({
      title: "Background restored",
      description: `Restored ${historyItem.type}: "${historyItem.prompt}"`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">Flux Kontext Editor</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          AI Powered
        </Badge>
      </div>

      {/* Current Background Preview */}
      {currentImageUrl && (
        <Card>
          <CardContent className="p-3">
            <div className="relative">
              <img
                src={currentImageUrl}
                alt="Current background"
                className="object-cover w-full h-24 rounded border"
              />
              <Badge className="absolute top-2 right-2 text-xs text-white bg-black/50">
                Current
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prompt Input */}
      <div className="space-y-2">
        <Label htmlFor="flux-prompt" className="text-sm">
          {currentImageUrl ? "Edit Instructions" : "Generate Background"}
        </Label>
        <Textarea
          id="flux-prompt"
          placeholder={
            currentImageUrl
              ? "Describe how to modify the background... (e.g., 'Add dramatic sunset lighting', 'Change to cyberpunk cityscape', 'Make it more colorful')"
              : "Describe the background you want... (e.g., 'Futuristic city skyline at sunset', 'Serene mountain landscape', 'Abstract geometric patterns')"
          }
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleFluxGenerate}
          disabled={isGenerating || isEditing || !editPrompt.trim()}
          size="sm"
          variant="outline"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 w-3 h-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 w-3 h-3" />
              Generate New
            </>
          )}
        </Button>

        <Button
          onClick={handleFluxEdit}
          disabled={
            isEditing || isGenerating || !editPrompt.trim() || !currentImageUrl
          }
          size="sm"
        >
          {isEditing ? (
            <>
              <Loader2 className="mr-2 w-3 h-3 animate-spin" />
              Editing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 w-3 h-3" />
              Edit Current
            </>
          )}
        </Button>
      </div>

      {!currentImageUrl && (
        <div className="flex gap-2 items-center p-2 text-xs bg-orange-50 rounded border border-orange-200 text-muted-foreground">
          <AlertTriangle className="w-3 h-3 text-orange-600" />
          <span>
            No background set. Use &quot;Generate New&quot; to create one from
            scratch.
          </span>
        </div>
      )}

      {/* Edit History */}
      {editHistory.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <RotateCw className="w-3 h-3" />
              <span className="text-xs font-medium">Recent Versions</span>
            </div>
            <div className="overflow-y-auto space-y-2 max-h-32">
              {editHistory
                .slice(-3)
                .reverse()
                .map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-start p-2 rounded border bg-muted/20"
                  >
                    <img
                      src={item.url}
                      alt={`Version ${index + 1}`}
                      className="object-cover w-12 h-8 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1 items-center">
                        <Badge
                          variant={
                            item.type === "generate" ? "default" : "secondary"
                          }
                          className="px-1 py-0 text-xs"
                        >
                          {item.type}
                        </Badge>
                      </div>
                      <p className="text-xs truncate text-muted-foreground">
                        {item.prompt}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2 mt-1 h-6 text-xs"
                        onClick={() => restoreFromHistory(item)}
                      >
                        <Download className="mr-1 w-3 h-3" />
                        Use
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Format Info */}
      <div className="text-xs text-muted-foreground">
        <span>
          Format: {sceneFormat} • Optimized for{" "}
          {sceneFormat === "9:16"
            ? "mobile/portrait"
            : sceneFormat === "16:9"
              ? "desktop/landscape"
              : "square"}
        </span>
      </div>
    </div>
  );
}
