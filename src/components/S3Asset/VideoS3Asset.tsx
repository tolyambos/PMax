"use client";

import { useEffect, useState } from "react";

import { useS3Asset } from "@/hooks/useS3Asset";

interface VideoS3AssetProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src" | "onError"> {
  url?: string;
  onError?: (error: Error) => void;
  ownerId?: string;
}

export function VideoS3Asset({
  url,
  onError,
  ownerId,
  className,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  ...props
}: VideoS3AssetProps) {
  // Replace asset-images with asset-videos in the URL if needed
  const videoUrl = url?.replace("pmax-images", "pmax-videos");

  const {
    url: currentUrl,
    handleAssetError,
    isLoading,
    error,
  } = useS3Asset(videoUrl, ownerId);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleVideoError = async () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount((prev) => prev + 1);
      try {
        await handleAssetError();
      } catch (error) {
        console.error("Failed to refresh asset URL:", error);
      }
    }
  };

  if (!currentUrl) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />
    );
  }

  return (
    <video
      autoPlay={autoPlay}
      className={className}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      onError={handleVideoError}
      {...props}
    >
      <source src={currentUrl} type="video/mp4" />
    </video>
  );
}
