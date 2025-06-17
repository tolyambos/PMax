"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";

type Asset = {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail?: string;
  tags: string[];
  createdAt: Date;
};

export default function AssetGrid() {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>(
    {}
  );
  const { toast } = useToast();

  // Fetch real assets from API
  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/assets");
        if (response.ok) {
          const data = await response.json();
          setAssets(data.assets || []);
        } else {
          console.error("Failed to fetch assets");
          toast({
            variant: "destructive",
            title: "Failed to load assets",
            description: "Please try refreshing the page.",
          });
        }
      } catch (error) {
        console.error("Error fetching assets:", error);
        toast({
          variant: "destructive",
          title: "Failed to load assets",
          description: "Please try refreshing the page.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, [toast]);

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
      setRefreshedUrls((prev) => {
        const newUrls = { ...prev };
        delete newUrls[id];
        return newUrls;
      });

      toast({
        title: "Asset deleted",
        description: "Asset has been removed from your library",
      });
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete asset. Please try again.",
      });
    }
  };

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
        <h3 className="mb-2 text-xl font-semibold">No assets yet</h3>
        <p className="mb-6 text-muted-foreground">
          Upload your first asset to get started.
        </p>
        <Button>Upload Asset</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="flex overflow-hidden flex-col rounded-lg border transition-colors group bg-card hover:bg-accent/50"
        >
          <div className="relative aspect-square bg-muted">
            {asset.type === "image" && asset.thumbnail && (
              <div className="relative w-full h-full">
                <Image
                  src={refreshedUrls[asset.id] || asset.thumbnail}
                  alt={asset.name}
                  fill
                  sizes="(max-width: 768px) 100px, 200px"
                  className="object-cover"
                  unoptimized={asset.thumbnail.startsWith("http")} // For external images
                />
              </div>
            )}
            {asset.type === "video" && asset.thumbnail && (
              <div className="relative w-full h-full">
                <div className="relative w-full h-full">
                  <Image
                    src={refreshedUrls[asset.id] || asset.thumbnail}
                    alt={asset.name}
                    fill
                    sizes="(max-width: 768px) 100px, 200px"
                    className="object-cover"
                    unoptimized={asset.thumbnail.startsWith("http")} // For external images
                  />
                </div>
                <div className="flex absolute inset-0 justify-center items-center">
                  <div className="flex justify-center items-center w-10 h-10 rounded-full bg-black/60">
                    <svg
                      width="20"
                      height="20"
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
              </div>
            )}
            {asset.type === "audio" && (
              <div className="flex justify-center items-center w-full h-full">
                <svg
                  width="40"
                  height="40"
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
            <div className="flex absolute inset-0 justify-center items-center opacity-0 transition-opacity bg-black/50 group-hover:opacity-100">
              <div className="flex gap-2">
                <button className="flex justify-center items-center w-9 h-9 rounded-full bg-background text-foreground hover:bg-muted">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="flex justify-center items-center w-9 h-9 rounded-full bg-background text-foreground hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(asset.id)}
                >
                  <svg
                    width="16"
                    height="16"
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
          <div className="flex flex-col flex-1 p-3">
            <h3 className="text-sm font-medium">{asset.name}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {asset.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
