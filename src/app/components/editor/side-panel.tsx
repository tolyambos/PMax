"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/app/components/ui/use-toast";
import ScenePanel from "./panels/scene-panel";
import ElementsPanel from "./panels/elements-panel";
import { Scene, Element, Asset } from "./types";

export type SidePanelProps = {
  scenes: Scene[];
  selectedSceneId?: string | null;
  selectedElementId?: string | null;
  onAddScenes?: (scenes: Scene[]) => void;
  onDeleteElement?: (sceneId: string, elementId: string) => void;
  onResizeElement?: (
    sceneId: string,
    elementId: string,
    width: number,
    height: number
  ) => void;
  onMoveElement?: (
    sceneId: string,
    elementId: string,
    x: number,
    y: number
  ) => void;
  onRotateElement?: (
    sceneId: string,
    elementId: string,
    rotation: number
  ) => void;
  onUpdateSceneDuration?: (sceneId: string, duration: number) => void;
  onUpdateSceneBackground?: (
    sceneId: string,
    imageUrl?: string,
    backgroundColor?: string
  ) => void;
  onToggleAnimation?: (
    sceneId: string,
    animate: boolean,
    imagePrompt?: string
  ) => void;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onElementSelect?: (elementId: string | null) => void;
  onSetGlobalElement?: (elementId: string, isGlobal: boolean) => void;
  globalElements?: Set<string>;
};

export default function SidePanel({
  scenes,
  selectedSceneId,
  selectedElementId,
  onAddScenes,
  onDeleteElement,
  onResizeElement,
  onMoveElement,
  onRotateElement,
  onUpdateSceneDuration,
  onUpdateSceneBackground,
  onToggleAnimation,
  onUpdateElement,
  onElementSelect,
  onSetGlobalElement,
  globalElements,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<"elements" | "scene">("scene");
  const { toast } = useToast();

  // Find the currently selected scene
  const selectedScene = selectedSceneId
    ? scenes.find((scene) => scene.id === selectedSceneId)
    : scenes[0];

  // Check if selected element still exists whenever scenes or selectedElementId changes
  useEffect(() => {
    if (selectedElementId && selectedSceneId) {
      const currentScene = scenes.find((scene) => scene.id === selectedSceneId);
      const elementExists = currentScene?.elements.some(
        (element) => element.id === selectedElementId
      );

      // If the element no longer exists, clear the selection
      if (!elementExists && onElementSelect) {
        console.log("Selected element no longer exists, clearing selection");
        onElementSelect(null);
      }
    }
  }, [scenes, selectedElementId, selectedSceneId, onElementSelect]);

  // Handle tab switching
  const handleTabChange = (tab: "elements" | "scene") => {
    // Before changing tabs, ensure fonts don't get removed
    const fontLinks = document.querySelectorAll(
      'link[href*="fonts.googleapis.com"]'
    );
    fontLinks.forEach((link) => {
      // Mark all font links as permanent to prevent removal
      link.setAttribute("data-permanent-font", "true");
    });

    // Change the active tab
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col w-[550px] border-l bg-background">
      <div className="flex border-b">
        <button
          className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === "scene"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
          }`}
          onClick={() => handleTabChange("scene")}
        >
          Scene
        </button>
        <button
          className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === "elements"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
          }`}
          onClick={() => handleTabChange("elements")}
        >
          Elements
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4">
        {activeTab === "scene" && (
          <ScenePanel
            scenes={scenes}
            selectedScene={selectedScene}
            selectedSceneId={selectedSceneId}
            onAddScenes={onAddScenes}
            onUpdateSceneDuration={onUpdateSceneDuration}
            onUpdateSceneBackground={onUpdateSceneBackground}
            onToggleAnimation={onToggleAnimation}
            toast={toast}
          />
        )}

        {activeTab === "elements" && (
          <ElementsPanel
            scenes={scenes}
            selectedScene={selectedScene}
            selectedSceneId={selectedSceneId}
            selectedElementId={selectedElementId}
            onAddScenes={onAddScenes}
            onDeleteElement={onDeleteElement}
            onResizeElement={onResizeElement}
            onMoveElement={onMoveElement}
            onRotateElement={onRotateElement}
            onUpdateElement={onUpdateElement}
            onElementSelect={onElementSelect}
            onSetGlobalElement={onSetGlobalElement}
            globalElements={globalElements ?? new Set()}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}
