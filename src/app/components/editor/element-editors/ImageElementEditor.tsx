"use client";

import { useState } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import { Switch } from "@/app/components/ui/switch";
import { useToast } from "@/app/components/ui/use-toast";
import {
  Image,
  Wand2,
  Upload,
  Download,
  Sparkles,
  Palette,
  Crop,
  RotateCw,
  Loader2,
} from "lucide-react";
import { Element } from "../types";

interface ImageElementEditorProps {
  element: Element;
  onUpdate: (updates: Partial<Element>) => void;
  sceneFormat?: "9:16" | "16:9" | "1:1" | "4:5";
}

export default function ImageElementEditor({
  element,
  onUpdate,
  sceneFormat = "9:16",
}: ImageElementEditorProps) {
  console.log("ImageElementEditor render:", {
    elementId: element.id,
    width: element.width,
    height: element.height,
  });
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editHistory, setEditHistory] = useState<
    Array<{ url: string; prompt: string }>
  >([]);
  const { toast } = useToast();

  const imageContent = element.content
    ? JSON.parse(element.content)
    : { src: "" };
  const currentImageUrl = imageContent.src || "";
  const [keepProportions, setKeepProportions] = useState(
    imageContent.keepProportions !== false
  ); // default to true

  const handleFluxEdit = async () => {
    if (!editPrompt.trim()) {
      toast({
        title: "Edit prompt required",
        description:
          "Please enter a description of how you'd like to edit the image.",
        variant: "destructive",
      });
      return;
    }

    if (!currentImageUrl) {
      toast({
        title: "No image to edit",
        description: "Please upload an image first before editing.",
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
        throw new Error(errorData.details || "Failed to edit image");
      }

      const result = await response.json();
      const editedImageUrl = result.data.imageURL;

      // Save to edit history
      setEditHistory((prev) => [
        ...prev,
        {
          url: editedImageUrl,
          prompt: editPrompt.trim(),
        },
      ]);

      // Update element with new image
      onUpdate({
        url: editedImageUrl, // Store in element.url for direct access
        content: JSON.stringify({
          ...imageContent,
          src: editedImageUrl, // Also store in content for tracking
          keepProportions, // Preserve keep proportions setting
        }),
      });

      toast({
        title: "Image edited successfully!",
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

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Upload file through your existing upload system
      // This would integrate with your uploadthing or S3 upload system
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadResult = await uploadResponse.json();

      onUpdate({
        url: uploadResult.url, // Store in element.url for direct access (old working pattern)
        content: JSON.stringify({
          ...imageContent,
          src: uploadResult.url, // Also store in content for content tracking
          keepProportions, // Preserve keep proportions setting
        }),
      });

      toast({
        title: "Image uploaded",
        description: "Image uploaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const restoreFromHistory = (historyItem: { url: string; prompt: string }) => {
    onUpdate({
      url: historyItem.url, // Store in element.url for direct access
      content: JSON.stringify({
        ...imageContent,
        src: historyItem.url, // Also store in content for tracking
        keepProportions, // Preserve keep proportions setting
      }),
    });

    toast({
      title: "Image restored",
      description: `Restored version: "${historyItem.prompt}"`,
    });
  };

  const handleKeepProportionsChange = (checked: boolean) => {
    setKeepProportions(checked);
    const updatedContent = { ...imageContent, keepProportions: checked };
    onUpdate({ content: JSON.stringify(updatedContent) });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const width = Number(e.target.value);
    console.log("Width change:", width, "Keep proportions:", keepProportions);
    if (keepProportions && element.width && element.height) {
      const aspectRatio = element.width / element.height;
      const height = width / aspectRatio;
      console.log("Updating with proportions:", { width, height });
      onUpdate({ width, height });
    } else {
      console.log("Updating width only:", { width });
      onUpdate({ width });
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const height = Number(e.target.value);
    if (keepProportions && element.width && element.height) {
      const aspectRatio = element.width / element.height;
      const width = height * aspectRatio;
      onUpdate({ width, height });
    } else {
      onUpdate({ height });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Image className="w-4 h-4" />
        <h3 className="font-medium">Image Editor</h3>
        <Badge variant="secondary" className="flex gap-1 items-center">
          <Sparkles className="w-3 h-3" />
          Flux Kontext
        </Badge>
      </div>

      <Tabs defaultValue="edit" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="edit">
            <Wand2 className="mr-2 w-4 h-4" />
            AI Edit
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="mr-2 w-4 h-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="history">
            <RotateCw className="mr-2 w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          <Card className="border-purple-200/50 dark:border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center text-sm">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Flux Kontext AI Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentImageUrl && (
                <div className="relative">
                  <img
                    src={currentImageUrl}
                    alt="Current image"
                    className="object-cover w-full h-32 rounded border"
                  />
                  <Badge className="absolute top-2 right-2 text-white bg-black/60 dark:bg-white/80 dark:text-black">
                    Current
                  </Badge>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-prompt">Edit Instructions</Label>
                <Textarea
                  id="edit-prompt"
                  placeholder="Describe how you want to edit the image... (e.g., 'Add a sunset background', 'Change to cyberpunk style', 'Remove the background')"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <Button
                onClick={handleFluxEdit}
                disabled={isEditing || !editPrompt.trim() || !currentImageUrl}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:from-purple-500 dark:to-blue-500 dark:hover:from-purple-600 dark:hover:to-blue-600"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Editing with Flux...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 w-4 h-4" />
                    Edit with Flux Kontext
                  </>
                )}
              </Button>

              {!currentImageUrl && (
                <div className="text-sm text-center text-muted-foreground">
                  Upload an image first to enable AI editing
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="p-6 rounded-lg border-2 border-dashed transition-colors border-border/50 dark:border-border/30 hover:border-border/80 dark:hover:border-border/50">
                  <div className="text-center">
                    <Upload className="mx-auto w-12 h-12 text-muted-foreground" />
                    <div className="mt-4">
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <span className="block mt-2 text-sm font-medium text-foreground">
                          Upload new image
                        </span>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                        />
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-center text-muted-foreground">
                  Supported formats: JPG, PNG, WebP (max 10MB)
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Edit History</CardTitle>
            </CardHeader>
            <CardContent>
              {editHistory.length === 0 ? (
                <div className="py-8 text-sm text-center text-muted-foreground">
                  No edits yet. Use the AI Edit tab to start creating
                  variations.
                </div>
              ) : (
                <div className="space-y-3">
                  {editHistory.map((item, index) => (
                    <div
                      key={index}
                      className="flex gap-3 items-start p-3 rounded-lg border transition-colors border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20"
                    >
                      <img
                        src={item.url}
                        alt={`Edit ${index + 1}`}
                        className="object-cover w-16 h-16 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Edit {index + 1}</p>
                        <p className="text-xs truncate text-muted-foreground">
                          {item.prompt}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => restoreFromHistory(item)}
                        >
                          <Download className="mr-1 w-3 h-3" />
                          Use This
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Basic Properties */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Properties</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="image-width" className="text-xs">
              Width
            </Label>
            <Input
              id="image-width"
              type="number"
              value={element.width || ""}
              onChange={handleWidthChange}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="image-height" className="text-xs">
              Height
            </Label>
            <Input
              id="image-height"
              type="number"
              value={element.height || ""}
              onChange={handleHeightChange}
              className="h-8"
            />
          </div>
          <div className="flex col-span-2 justify-between items-center">
            <Label htmlFor="keep-proportions" className="text-xs">
              Keep proportions
            </Label>
            <Switch
              id="keep-proportions"
              checked={keepProportions}
              onCheckedChange={handleKeepProportionsChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
