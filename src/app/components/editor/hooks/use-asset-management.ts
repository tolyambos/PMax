/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor } from "../context/editor-context";
import { useToast } from "@/app/components/ui/use-toast";
import { Asset, Element, Scene } from "../types";
import { generateElementId } from "../../../utils/element-utils";

/**
 * Hook for managing assets in the editor
 */
export function useAssetManagement() {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<Asset[]>([]);

  // Load assets on component mount
  useEffect(() => {
    loadAssets();
  }, []);

  // Function to load assets from API
  const loadAssets = useCallback(async () => {
    setIsLoading(true);

    try {
      // Call API to get assets
      const response = await fetch("/api/assets");

      if (!response.ok) {
        throw new Error("Failed to load assets");
      }

      const data = await response.json();
      setAssets(data.assets);
    } catch (error) {
      console.error("Error loading assets:", error);
      toast({
        variant: "destructive",
        title: "Failed to load assets",
        description: "Could not load your asset library. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Function to add an asset to the current scene
  const addAssetToScene = useCallback(
    (asset: Asset, sceneId: string | null = null) => {
      // Use selected scene ID if none provided
      const targetSceneId = sceneId || state.selectedSceneId;

      if (!targetSceneId) {
        toast({
          variant: "destructive",
          title: "No scene selected",
          description: "Please select a scene before adding assets",
        });
        return;
      }

      // Create a new element based on the asset
      const newElement: Element = {
        id: generateElementId(),
        type: asset.type,
        assetId: asset.id,
        url: asset.url,
        x: 50, // Default position in the center
        y: 50,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1,
        zIndex: 10, // Will be set based on existing elements
      };

      // Add the element to the scene
      dispatch({
        type: "ADD_ELEMENT",
        payload: {
          sceneId: targetSceneId,
          element: newElement,
        },
      });

      toast({
        title: "Asset added",
        description: `Added ${asset.name} to the scene`,
      });
    },
    [state.selectedSceneId, dispatch, toast]
  );

  // Function to use an asset as scene background
  const setAssetAsBackground = useCallback(
    (asset: Asset, sceneId: string | null = null) => {
      // Use selected scene ID if none provided
      const targetSceneId = sceneId || state.selectedSceneId;

      if (!targetSceneId) {
        toast({
          variant: "destructive",
          title: "No scene selected",
          description: "Please select a scene first",
        });
        return;
      }

      // Only images can be used as backgrounds
      if (asset.type !== "image") {
        toast({
          variant: "destructive",
          title: "Invalid asset type",
          description: "Only images can be used as backgrounds",
        });
        return;
      }

      // Update the scene background
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId: targetSceneId,
          updates: { imageUrl: asset.url },
        },
      });

      toast({
        title: "Background updated",
        description: "Scene background has been updated",
      });
    },
    [state.selectedSceneId, dispatch, toast]
  );

  // Function to create a new scene from an asset
  const createSceneFromAsset = useCallback(
    (asset: Asset) => {
      // Create a new scene with the asset
      const newSceneId = `scene-${Date.now()}`;

      // Create a scene with proper structure
      const newScene: Scene = {
        id: newSceneId,
        order: state.scenes.length,
        duration: 3,
        elements: [],
        isNewScene: true, // Flag this as a new scene
      };

      // If it's an image, use it as background
      if (asset.type === "image") {
        (newScene as any).imageUrl = asset.url;
      }
      // Otherwise add it as an element
      else {
        const newElement: Element = {
          id: generateElementId(),
          type: asset.type,
          assetId: asset.id,
          url: asset.url,
          x: 50, // Center of scene
          y: 50,
          width: 200,
          height: 200,
          rotation: 0,
          opacity: 1,
          zIndex: 0,
        };

        newScene.elements.push(newElement);
      }

      // Add the new scene
      dispatch({
        type: "ADD_SCENES",
        payload: [newScene],
      });

      toast({
        title: "Scene created",
        description: `Created a new scene from ${asset.name}`,
      });
    },
    [state.scenes.length, dispatch, toast]
  );

  // Function to upload new assets
  const uploadAssets = useCallback(
    async (files: File[]) => {
      setIsLoading(true);

      try {
        // Create FormData for file upload
        const formData = new FormData();
        files.forEach((file) => {
          formData.append("files", file);
        });

        // Upload files
        const response = await fetch("/api/assets/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload assets");
        }

        const data = await response.json();

        // Add new assets to state
        setAssets((prevAssets) => [...data.assets, ...prevAssets]);

        toast({
          title: "Assets uploaded",
          description: `Successfully uploaded ${files.length} asset(s)`,
        });

        return data.assets;
      } catch (error) {
        console.error("Error uploading assets:", error);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: "Failed to upload assets. Please try again.",
        });
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Function to handle AI-generated assets
  const handleGeneratedAsset = useCallback(
    (asset: Asset, addToCurrentScene: boolean = false) => {
      // Add to generated assets collection
      setGeneratedAssets((prev) => [asset, ...prev]);

      // If requested, add to current scene
      if (addToCurrentScene && state.selectedSceneId) {
        addAssetToScene(asset, state.selectedSceneId);
      }

      return asset;
    },
    [state.selectedSceneId, addAssetToScene]
  );

  // Function to delete an asset
  const deleteAsset = useCallback(
    async (assetId: string) => {
      try {
        // Call API to delete the asset
        const response = await fetch(`/api/assets/${assetId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete asset");
        }

        // Remove from local state
        setAssets((prevAssets) =>
          prevAssets.filter((asset) => asset.id !== assetId)
        );
        setGeneratedAssets((prevAssets) =>
          prevAssets.filter((asset) => asset.id !== assetId)
        );

        toast({
          title: "Asset deleted",
          description: "Asset has been removed from your library",
        });
      } catch (error) {
        console.error("Error deleting asset:", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "Failed to delete asset. Please try again.",
        });
      }
    },
    [toast]
  );

  // Function to search assets
  const searchAssets = useCallback(
    (query: string) => {
      if (!query) {
        return assets; // Return all assets if query is empty
      }

      // Search by name, type, and tags
      const lowerQuery = query.toLowerCase();
      return assets.filter(
        (asset) =>
          asset.name.toLowerCase().includes(lowerQuery) ||
          asset.type.toLowerCase().includes(lowerQuery) ||
          (asset.tags &&
            typeof asset.tags === "string" &&
            asset.tags.toLowerCase().includes(lowerQuery))
      );
    },
    [assets]
  );

  // Function to filter assets by type
  const filterAssetsByType = useCallback(
    (type: string | null) => {
      if (!type) {
        return assets; // Return all assets if no type filter
      }

      return assets.filter((asset) => asset.type === type);
    },
    [assets]
  );

  // Function to check if an asset is in use
  const isAssetInUse = useCallback(
    (assetId: string) => {
      return state.scenes.some(
        (scene) =>
          // Check in background
          (scene.imageUrl && scene.imageUrl.includes(assetId)) ||
          // Check in elements
          scene.elements.some(
            (element) =>
              element.assetId === assetId ||
              (element.url && element.url.includes(assetId))
          )
      );
    },
    [state.scenes]
  );

  return {
    assets,
    generatedAssets,
    isLoading,
    loadAssets,
    addAssetToScene,
    setAssetAsBackground,
    createSceneFromAsset,
    uploadAssets,
    handleGeneratedAsset,
    deleteAsset,
    searchAssets,
    filterAssetsByType,
    isAssetInUse,
  };
}
