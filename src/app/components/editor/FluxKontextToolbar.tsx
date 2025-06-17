"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Sparkles, Image, Palette, Wand2, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import FluxBackgroundEditor from "./panels/FluxBackgroundEditor";
import { useEditor } from "./context/editor-context";

interface FluxKontextToolbarProps {
  onOpenImageEditor?: () => void;
  toast: (props: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

export default function FluxKontextToolbar({
  onOpenImageEditor,
  toast,
}: FluxKontextToolbarProps) {
  const [isBackgroundEditorOpen, setIsBackgroundEditorOpen] = useState(false);
  const { state, dispatch } = useEditor();

  const selectedScene = state.selectedSceneId
    ? state.scenes.find((scene) => scene.id === state.selectedSceneId)
    : null;

  const selectedElement = state.selectedElementId
    ? selectedScene?.elements.find(
        (element) => element.id === state.selectedElementId
      )
    : null;

  const hasImageElements =
    selectedScene?.elements.some((element) => element.type === "image") ||
    false;
  const hasImageBackground = selectedScene?.imageUrl;

  const handleBackgroundUpdate = (imageUrl: string) => {
    if (selectedScene) {
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: selectedScene.id,
          updates: { imageUrl, backgroundColor: undefined },
        },
      });

      toast({
        title: "Background updated",
        description: "Scene background has been updated with Flux Kontext.",
      });
    }
  };

  const handleAddImageElement = () => {
    if (selectedScene) {
      const newElement = {
        id: `flux-image-${Date.now()}`,
        type: "image" as const,
        content: JSON.stringify({ src: "" }),
        x: 50,
        y: 50,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1,
        zIndex: selectedScene.elements.length,
      };

      dispatch({
        type: "ADD_ELEMENT",
        payload: {
          sceneId: selectedScene.id,
          element: newElement,
        },
      });

      dispatch({
        type: "SELECT_ELEMENT",
        payload: newElement.id,
      });

      toast({
        title: "Image element added",
        description: "New image element ready for Flux Kontext editing.",
      });
    }
  };

  // Get scene format based on dimensions
  const getSceneFormat = (): "9:16" | "16:9" | "1:1" | "4:5" => {
    // This would ideally come from your scene/project settings
    // For now, defaulting to 9:16 but you can make this dynamic
    return "9:16";
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:from-purple-100 hover:to-blue-100"
          >
            <Sparkles className="mr-2 w-4 h-4 text-purple-600" />
            <span>Flux Kontext</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              AI
            </Badge>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex gap-2 items-center">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Flux Kontext AI Editor
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Background Editing */}
          <DropdownMenuItem
            onClick={() => setIsBackgroundEditorOpen(true)}
            className="flex gap-2 items-center"
          >
            <Palette className="w-4 h-4" />
            <div className="flex-1">
              <div className="font-medium">Edit Background</div>
              <div className="text-xs text-muted-foreground">
                {hasImageBackground
                  ? "Modify current background"
                  : "Generate new background"}
              </div>
            </div>
          </DropdownMenuItem>

          {/* Image Elements */}
          <DropdownMenuItem
            onClick={handleAddImageElement}
            className="flex gap-2 items-center"
          >
            <Plus className="w-4 h-4" />
            <div className="flex-1">
              <div className="font-medium">Add Image Element</div>
              <div className="text-xs text-muted-foreground">
                Create new image for editing
              </div>
            </div>
          </DropdownMenuItem>

          {selectedElement?.type === "image" && (
            <DropdownMenuItem
              onClick={onOpenImageEditor}
              className="flex gap-2 items-center"
            >
              <Wand2 className="w-4 h-4" />
              <div className="flex-1">
                <div className="font-medium">Edit Selected Image</div>
                <div className="text-xs text-muted-foreground">
                  AI-powered image editing
                </div>
              </div>
            </DropdownMenuItem>
          )}

          {hasImageElements && !selectedElement && (
            <DropdownMenuItem
              onClick={() => {
                toast({
                  title: "Select an image element",
                  description:
                    "Click on an image element to edit it with Flux Kontext.",
                });
              }}
              className="flex gap-2 items-center"
            >
              <Image className="w-4 h-4" />
              <div className="flex-1">
                <div className="font-medium">Edit Image Elements</div>
                <div className="text-xs text-muted-foreground">
                  Select an image to start editing
                </div>
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Status Info */}
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {selectedScene
              ? `Scene: ${selectedScene.id.substring(0, 8)}...`
              : "No scene selected"}
          </div>

          {selectedElement && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Selected: {selectedElement.type} element
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Background Editor Dialog */}
      <Dialog
        open={isBackgroundEditorOpen}
        onOpenChange={setIsBackgroundEditorOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex gap-2 items-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Edit Scene Background
            </DialogTitle>
            <DialogDescription>
              Use Flux Kontext AI to create or modify your scene background with
              natural language instructions.
            </DialogDescription>
          </DialogHeader>

          <FluxBackgroundEditor
            currentImageUrl={selectedScene?.imageUrl}
            sceneFormat={getSceneFormat()}
            onBackgroundUpdate={handleBackgroundUpdate}
            toast={toast}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
