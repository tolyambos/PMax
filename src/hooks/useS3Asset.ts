"use client";

import { useEffect, useState } from "react";

interface ImageError extends Error {
  statusCode?: number;
}

export function useS3Asset(url?: string, ownerId?: string) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ImageError | null>(null);

  useEffect(() => {
    if (!url) {
      setCurrentUrl(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // If the URL is already a presigned URL or external URL, use it directly
    if (url.includes("?X-Amz-") || !url.includes("wasabisys.com")) {
      setCurrentUrl(url);
      setIsLoading(false);
      return;
    }

    // For S3 URLs, get a fresh presigned URL
    const refreshUrl = async () => {
      try {
        const response = await fetch("/api/s3/presigned-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, ownerId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get presigned URL");
        }

        const data = await response.json();
        setCurrentUrl(data.presignedUrl);
      } catch (err) {
        const error = err as ImageError;
        console.error("Failed to get presigned URL:", error);

        // If it's a 403/404 error, don't show it to the user
        if (error.message?.includes("403") || error.message?.includes("404")) {
          setCurrentUrl(null);
        } else {
          setError(error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    refreshUrl();
  }, [url, ownerId]);

  const handleAssetError = async (): Promise<void> => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/s3/refresh-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, ownerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh URL");
      }

      const data = await response.json();
      setCurrentUrl(data.presignedUrl);
    } catch (err) {
      const error = err as ImageError;
      console.error("Failed to refresh URL:", error);

      // Only set error for non-403 errors
      if (!error.message?.includes("403")) {
        setError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    url: currentUrl,
    isLoading,
    error,
    handleAssetError,
  };
}
