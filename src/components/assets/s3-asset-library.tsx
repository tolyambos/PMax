"use client";

import { useState, useEffect } from "react";
import { S3AssetMemoized } from "@/components/S3Asset";
import { S3UploadButton } from "./s3-upload-button";
import { Button } from "@/app/components/ui/button";
import { toast } from "@/app/components/ui/use-toast";

interface Asset {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail?: string;
  tags: string[];
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

export function S3AssetLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssets = async () => {
    try {
      const response = await fetch("/api/assets");
      if (!response.ok) throw new Error("Failed to fetch assets");

      const data = await response.json();
      setAssets(data.assets || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleUploadComplete = (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev]);
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const response = await fetch("/api/s3/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assetId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete asset");
      }

      setAssets((prev) => prev.filter((asset) => asset.id !== assetId));

      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    const mb = kb / 1024;

    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${kb.toFixed(2)} KB`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading assets...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">S3 Asset Library</h2>
        <S3UploadButton
          onUploadComplete={handleUploadComplete}
          multiple
          className="mb-4"
        >
          Upload New Assets
        </S3UploadButton>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No assets uploaded yet</div>
          <S3UploadButton onUploadComplete={handleUploadComplete}>
            Upload Your First Asset
          </S3UploadButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden">
                {asset.type.includes("image") ? (
                  <S3AssetMemoized
                    url={asset.url}
                    alt={asset.name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                ) : asset.type.includes("video") ? (
                  <S3AssetMemoized
                    url={asset.url}
                    alt={asset.name}
                    width={200}
                    height={200}
                    asVideo
                    videoClassName="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <div className="text-sm text-gray-500 text-center">
                      {asset.type.toUpperCase()}
                      <br />
                      File
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-sm truncate" title={asset.name}>
                  {asset.name}
                </h3>

                <div className="text-xs text-gray-500 space-y-1">
                  <div>Type: {asset.type}</div>
                  <div>Size: {formatFileSize(asset.fileSize)}</div>
                  {asset.tags.length > 0 && (
                    <div>
                      Tags: {asset.tags.slice(0, 2).join(", ")}
                      {asset.tags.length > 2 && "..."}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleDeleteAsset(asset.id)}
                  variant="destructive"
                  size="sm"
                  className="w-full mt-3"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
