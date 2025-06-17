"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Input } from "@/app/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import UploadButton from "./upload-button";
import { Search, Film, Layout } from "lucide-react";

export type Asset = {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail?: string;
  tags: string | string[];
  createdAt: Date;
};

interface AssetLibraryProps {
  onAssetSelect?: (asset: Asset, createNewScene?: boolean) => void;
}

export default function AssetLibrary({ onAssetSelect }: AssetLibraryProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>(
    {}
  );

  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      const dropdowns = document.querySelectorAll(".asset-dropdown");
      dropdowns.forEach((dropdown) => {
        dropdown.classList.add("hidden");
      });
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Fetch real assets from the API
  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/assets");
        const data = await response.json();

        if (data.success) {
          setAssets(data.assets);
        } else {
          console.error("Failed to fetch assets:", data.error);
        }
      } catch (error) {
        console.error("Error fetching assets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, []);

  // Function to refresh S3 URLs
  const refreshS3Url = async (url: string): Promise<string> => {
    if (
      !url ||
      (!url.includes("wasabisys.com") &&
        !url.includes("amazonaws.com") &&
        !url.includes("s3."))
    ) {
      return url;
    }

    try {
      const response = await fetch("/api/s3/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.presignedUrl || url;
      }
    } catch (error) {
      console.error("[refreshS3Url] Error refreshing S3 URL:", error);
    }

    return url;
  };

  // Refresh URLs for assets when they load
  useEffect(() => {
    const refreshAssetUrls = async () => {
      const urlPromises = assets.map(async (asset) => {
        if (asset.thumbnail) {
          const refreshedUrl = await refreshS3Url(asset.thumbnail);
          return [asset.id, refreshedUrl];
        }
        return [asset.id, asset.thumbnail];
      });

      const results = await Promise.all(urlPromises);
      const urlMap = Object.fromEntries(results);
      setRefreshedUrls(urlMap);
    };

    if (assets.length > 0) {
      refreshAssetUrls();
    }
  }, [assets]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete asset");
      }

      // Remove from local state
      setAssets(assets.filter((asset) => asset.id !== id));
    } catch (error) {
      console.error("Error deleting asset:", error);
      // You might want to add toast notification here
    }
  };

  // Directly pass the asset to parent component
  const handleAssetSelect = (asset: Asset, createNewScene: boolean = false) => {
    console.log(
      "Asset library handleAssetSelect called with createNewScene =",
      createNewScene
    );
    if (onAssetSelect) {
      onAssetSelect(asset, createNewScene);
    } else {
      console.error("No onAssetSelect handler provided");
    }
  };

  const filteredAssets = assets.filter((asset) => {
    // Filter by type
    const typeMatch = activeFilter === "all" || asset.type === activeFilter;

    // Filter by search term
    const searchMatch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Array.isArray(asset.tags)
        ? asset.tags.some((tag: string) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : asset.tags.toLowerCase().includes(searchTerm.toLowerCase()));

    return typeMatch && searchMatch;
  });

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData("application/json", JSON.stringify(asset));
    e.dataTransfer.effectAllowed = "copy";
  };

  const fetchAssets = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/assets");
      const data = await response.json();

      if (data.success) {
        setAssets(data.assets);
      } else {
        console.error("Failed to fetch assets:", data.error);
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-2">
        <h2 className="text-lg font-semibold">Assets</h2>
        <div className="flex items-center space-x-2">
          <UploadButton onUploadComplete={fetchAssets} />
        </div>
      </div>

      <div className="relative px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs
        defaultValue="all"
        value={activeFilter}
        onValueChange={setActiveFilter}
        className="flex-1"
      >
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="overflow-y-auto flex-1 p-4">
          <AssetGrid
            assets={filteredAssets}
            isLoading={isLoading}
            onDelete={handleDelete}
            onSelect={handleAssetSelect}
            onDragStart={handleDragStart}
            refreshedUrls={refreshedUrls}
          />
        </TabsContent>

        <TabsContent value="image" className="overflow-y-auto flex-1 p-4">
          <AssetGrid
            assets={filteredAssets}
            isLoading={isLoading}
            onDelete={handleDelete}
            onSelect={handleAssetSelect}
            onDragStart={handleDragStart}
            refreshedUrls={refreshedUrls}
          />
        </TabsContent>

        <TabsContent value="video" className="overflow-y-auto flex-1 p-4">
          <AssetGrid
            assets={filteredAssets}
            isLoading={isLoading}
            onDelete={handleDelete}
            onSelect={handleAssetSelect}
            onDragStart={handleDragStart}
            refreshedUrls={refreshedUrls}
          />
        </TabsContent>

        <TabsContent value="audio" className="overflow-y-auto flex-1 p-4">
          <AssetGrid
            assets={filteredAssets}
            isLoading={isLoading}
            onDelete={handleDelete}
            onSelect={handleAssetSelect}
            onDragStart={handleDragStart}
            refreshedUrls={refreshedUrls}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AssetGridProps {
  assets: Asset[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onSelect?: (asset: Asset, createNewScene?: boolean) => void;
  onDragStart?: (e: React.DragEvent, asset: Asset) => void;
  refreshedUrls?: Record<string, string>;
}

function AssetGrid({
  assets,
  isLoading,
  onDelete,
  onSelect,
  onDragStart,
  refreshedUrls,
}: AssetGridProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 justify-center items-center">
        <div className="text-lg text-muted-foreground">Loading assets...</div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col flex-1 justify-center items-center p-12 rounded-lg border border-dashed">
        <h3 className="mb-2 text-xl font-semibold">No assets found</h3>
        <p className="mb-6 text-center text-muted-foreground">
          Upload your first asset to get started or try a different search term.
        </p>
        <UploadButton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="flex overflow-hidden rounded-md border transition-colors cursor-pointer group bg-card hover:bg-accent/50"
          onClick={(e) => {
            // Do nothing on main asset click - we want the user to use the dropdown
            e.preventDefault();
            e.stopPropagation();
            // Show the asset dropdown
            const assetDropdowns = document.querySelectorAll(".asset-dropdown");
            assetDropdowns.forEach((d) => d.classList.add("hidden"));

            // Find this asset's dropdown and show it
            const currentRow = e.currentTarget;
            const dropdownButton =
              currentRow.querySelector(".dropdown-trigger");
            if (dropdownButton) {
              // Simulate a click on the dropdown button
              dropdownButton.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                })
              );
            }
          }}
          draggable={true}
          onDragStart={(e) => onDragStart && onDragStart(e, asset)}
        >
          {/* Thumbnail */}
          <div className="relative flex-shrink-0 w-10 h-10 bg-muted">
            {asset.type === "image" && asset.thumbnail && (
              <div className="relative w-full h-full">
                <Image
                  src={refreshedUrls?.[asset.id] || asset.thumbnail}
                  alt={asset.name}
                  fill
                  sizes="100px"
                  className="object-cover"
                  unoptimized={asset.thumbnail.startsWith("http")} // For external images
                />
              </div>
            )}
            {asset.type === "video" && asset.thumbnail && (
              <div className="relative w-full h-full">
                <div className="relative w-full h-full">
                  <Image
                    src={refreshedUrls?.[asset.id] || asset.thumbnail}
                    alt={asset.name}
                    fill
                    sizes="100px"
                    className="object-cover"
                    unoptimized={asset.thumbnail.startsWith("http")} // For external images
                  />
                </div>
                <div className="flex absolute inset-0 justify-center items-center bg-black/30">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 5V19L19 12L8 5Z"
                      fill="white"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            )}
            {asset.type === "audio" && (
              <div className="flex justify-center items-center w-full h-full bg-primary/10">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 18V12M9 12V6M9 12H15M15 18V12M15 12V6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Asset info */}
          <div className="flex flex-1 items-center px-2 py-1 min-w-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-medium truncate">{asset.name}</h3>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {Array.isArray(asset.tags)
                  ? // If tags is already an array, use it directly
                    asset.tags
                      .filter(Boolean)
                      .slice(0, 1)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[10px] bg-secondary rounded-sm"
                        >
                          {tag}
                        </span>
                      ))
                  : // If tags is a string, split it first
                    (asset.tags || "")
                      .split(",")
                      .filter(Boolean)
                      .slice(0, 1)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[10px] bg-secondary rounded-sm"
                        >
                          {tag}
                        </span>
                      ))}
                {Array.isArray(asset.tags) ? (
                  asset.tags.filter(Boolean).length > 1
                ) : (asset.tags || "").split(",").filter(Boolean).length > 1 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +
                    {Array.isArray(asset.tags)
                      ? asset.tags.filter(Boolean).length - 1
                      : (asset.tags || "").split(",").filter(Boolean).length -
                        1}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-1 ml-1">
              {/* Add to current scene button */}
              <button
                className="flex justify-center items-center w-5 h-5 rounded bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();

                  console.log("Current scene button clicked for:", asset.name);
                  // Add to current scene
                  if (onSelect) {
                    console.log("Calling onSelect with createNewScene = false");
                    onSelect(asset, false);
                  } else {
                    console.error("No onSelect handler provided");
                  }
                }}
                title="Add to current scene"
              >
                <Layout className="w-3 h-3" />
              </button>

              {/* Create new scene button */}
              <button
                className="flex justify-center items-center w-5 h-5 rounded bg-primary text-primary-foreground hover:bg-primary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();

                  console.log("New scene button clicked for:", asset.name);
                  // Create new scene
                  if (onSelect) {
                    console.log("Calling onSelect with createNewScene = true");
                    onSelect(asset, true);
                  } else {
                    console.error("No onSelect handler provided");
                  }
                }}
                title="Create new scene"
              >
                <Film className="w-3 h-3" />
              </button>

              {/* Delete button */}
              <button
                className="flex justify-center items-center w-5 h-5 rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();

                  console.log("Delete button clicked for:", asset.name);
                  if (onDelete) {
                    onDelete(asset.id);
                  }
                }}
                title="Delete asset"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 18L18 6M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
