"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { S3AssetMemoized } from "@/components/S3Asset";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import Timeline from "./timeline";
import AssetPanel from "./asset-panel";
import { Asset } from "@/app/components/assets/asset-library";
import { mockScenes } from "@/app/mock-data";

interface EditorLayoutProps {
  id: string;
}

export default function EditorLayout({ id }: EditorLayoutProps) {
  const [scenes, setScenes] = useState<any[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate loading project data
    const loadProject = async () => {
      setIsLoading(true);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Use mock data for demo
      setScenes(mockScenes);
      if (mockScenes.length > 0) {
        setSelectedSceneId(mockScenes[0].id);
      }

      setIsLoading(false);
    };

    loadProject();
  }, [id]);

  const handleAddScene = () => {
    const newScene = {
      id: `scene-${Date.now()}`,
      order: scenes.length,
      duration: 3,
      elements: [],
    };

    setScenes([...scenes, newScene]);
    setSelectedSceneId(newScene.id);

    toast({
      title: "Scene added",
      description: "New scene has been added to your project",
    });
  };

  const handleAddAssetToScene = (sceneId: string, asset: Asset) => {
    // Create a new element based on the asset
    const newElement = {
      id: `element-${Date.now()}`,
      type: asset.type,
      assetId: asset.id,
      x: 50, // Default position
      y: 50,
      width: 200,
      height: 200,
      rotation: 0,
      opacity: 1,
      zIndex: 0, // Will be adjusted based on existing elements
    };

    // Update the scenes with the new element
    const updatedScenes = scenes.map((scene) => {
      if (scene.id === sceneId) {
        return {
          ...scene,
          elements: [
            ...scene.elements,
            {
              ...newElement,
              zIndex: scene.elements.length, // Put on top of other elements
            },
          ],
        };
      }
      return scene;
    });

    setScenes(updatedScenes);

    toast({
      title: "Asset added",
      description: `${asset.name} has been added to the scene`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg">Loading project...</div>
      </div>
    );
  }

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center px-6 h-16 border-b">
        <div className="flex gap-4 items-center">
          <Button variant="ghost" size="sm">
            <svg
              className="mr-2 w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-semibold">Project Editor</h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Preview
          </Button>
          <Button size="sm">Export</Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex overflow-hidden flex-1">
        {/* Preview Area */}
        <div className="flex overflow-hidden flex-col flex-1">
          <div className="flex flex-1 justify-center items-center p-4 bg-muted/50">
            {selectedScene && selectedScene.imageUrl ? (
              <div className="relative h-[500px] w-[800px] max-h-full">
                <S3AssetMemoized
                  url={selectedScene.imageUrl}
                  alt="Selected scene"
                  width={800}
                  height={500}
                  className="object-contain rounded-lg shadow-lg w-full h-full"
                />
              </div>
            ) : (
              <div className="flex justify-center items-center w-64 h-64 rounded-lg border border-dashed">
                <p className="text-center text-muted-foreground">
                  {scenes.length === 0
                    ? "No scenes yet. Add your first scene below."
                    : "Select a scene to preview"}
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <Timeline
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            onSelectScene={setSelectedSceneId}
            onAddScene={handleAddScene}
            onAddAssetToScene={handleAddAssetToScene}
          />
        </div>

        {/* Asset Panel */}
        <AssetPanel
          onAssetAdd={(asset) => {
            if (selectedSceneId) {
              handleAddAssetToScene(selectedSceneId, asset);
            } else {
              toast({
                variant: "destructive",
                title: "No scene selected",
                description: "Please select a scene first to add this asset",
              });
            }
          }}
        />
      </div>
    </div>
  );
}
