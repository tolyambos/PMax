"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Save } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";

import { createElementContent } from "@/app/utils/element-utils";
import { Element } from "./types";
import { useLocalFonts } from "@/app/utils/fonts";

// Import element-specific components
import TextElementEditor from "./element-editors/TextElementEditor";
import ShapeElementEditor from "./element-editors/ShapeElementEditor";
import CTAElementEditor from "./element-editors/CTAElementEditor";
import LogoElementEditor from "./element-editors/LogoElementEditor";
import ImageElementEditor from "./element-editors/ImageElementEditor";

// Props interface
export interface ElementToolbarProps {
  onAddElement: (elementConfig: any) => void;
  sceneId: string;
  selectedElement?: Element;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onMakeElementGlobal?: (element: Element) => void;
}

export function ElementToolbar({
  onAddElement,
  sceneId,
  selectedElement,
  onUpdateElement,
  onMakeElementGlobal,
}: ElementToolbarProps) {
  // State to track whether we're in edit mode or add mode
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("text");

  // Preload commonly used fonts
  useLocalFonts(["Roboto", "OpenSans", "Barlow", "Montserrat", "Nunito"]);

  // Set edit mode based on whether an element is selected
  useEffect(() => {
    setIsEditMode(!!selectedElement);

    // If we have a selected element, set the active tab based on its type
    if (selectedElement) {
      setActiveTab(selectedElement.type);
    }
  }, [selectedElement]);

  // Render the appropriate action button based on whether we're in edit or add mode
  const renderActionButton = () => {
    if (isEditMode && selectedElement) {
      return (
        <Button
          onClick={() => {
            // The update function is called directly from the specific editor component
          }}
          className="w-full"
          disabled={true} // We don't need this button anymore as updates are immediate
        >
          <Save className="mr-2 w-4 h-4" />
          Update Element
        </Button>
      );
    } else {
      // This button is also not needed as each editor handles its own add functionality
      return null;
    }
  };

  // Each tab is a different element type editor
  return (
    <div className="space-y-4 rounded-lg bg-background">
      {/* If we're in edit mode, only show the editor for the selected element type */}
      {isEditMode && selectedElement ? (
        <div>
          {selectedElement.type === "text" && (
            <TextElementEditor
              selectedElement={selectedElement}
              sceneId={sceneId}
              onUpdateElement={onUpdateElement}
              isEditMode={isEditMode}
            />
          )}
          {selectedElement.type === "shape" && (
            <ShapeElementEditor
              selectedElement={selectedElement}
              sceneId={sceneId}
              onUpdateElement={onUpdateElement}
              isEditMode={isEditMode}
            />
          )}
          {selectedElement.type === "cta" && (
            <CTAElementEditor
              selectedElement={selectedElement}
              sceneId={sceneId}
              onUpdateElement={onUpdateElement}
              isEditMode={isEditMode}
            />
          )}
          {selectedElement.type === "logo" && (
            <LogoElementEditor
              selectedElement={selectedElement}
              sceneId={sceneId}
              onUpdateElement={onUpdateElement}
              isEditMode={isEditMode}
            />
          )}
          {selectedElement.type === "image" && (
            <ImageElementEditor
              key={`${selectedElement.id}-${selectedElement.width}-${selectedElement.height}`}
              element={selectedElement}
              onUpdate={(updates) => {
                console.log("🎯 ElementToolbar: onUpdate called with:", {
                  sceneId,
                  selectedElementId: selectedElement.id,
                  updates,
                });
                if (onUpdateElement) {
                  onUpdateElement(sceneId, selectedElement.id, updates);
                }
              }}
            />
          )}
        </div>
      ) : (
        // If we're in add mode, show tabs for all element types
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="shape">Shape</TabsTrigger>
            <TabsTrigger value="cta">CTA</TabsTrigger>
            <TabsTrigger value="logo">Logo</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="pt-2">
            <TextElementEditor
              sceneId={sceneId}
              onAddElement={onAddElement}
              isEditMode={isEditMode}
            />
          </TabsContent>

          <TabsContent value="image" className="pt-2">
            <ImageElementEditor
              element={{
                id: "new-image",
                type: "image",
                content: JSON.stringify({ src: "" }),
                x: 50,
                y: 50,
                width: 200,
                height: 200,
                rotation: 0,
                opacity: 1,
                zIndex: 0,
              }}
              onUpdate={(updates) => {
                // For new elements, we add them instead of updating
                if (updates.content) {
                  const content = JSON.parse(updates.content);
                  if (content.src) {
                    const newElement = {
                      id: `image-${Date.now()}`,
                      type: "image" as const,
                      content: updates.content,
                      x: 50,
                      y: 50,
                      width: updates.width || 200,
                      height: updates.height || 200,
                      rotation: 0,
                      opacity: 1,
                      zIndex: 0,
                    };
                    onAddElement(newElement);
                  }
                }
              }}
            />
          </TabsContent>

          <TabsContent value="shape" className="pt-2">
            <ShapeElementEditor
              sceneId={sceneId}
              onAddElement={onAddElement}
              isEditMode={isEditMode}
            />
          </TabsContent>

          <TabsContent value="cta" className="pt-2">
            <CTAElementEditor
              sceneId={sceneId}
              onAddElement={onAddElement}
              isEditMode={isEditMode}
            />
          </TabsContent>

          <TabsContent value="logo" className="pt-2">
            <LogoElementEditor
              sceneId={sceneId}
              onAddElement={onAddElement}
              isEditMode={isEditMode}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
