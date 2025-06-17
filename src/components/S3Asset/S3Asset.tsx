"use client";

import React, { memo, useEffect, useState } from "react";
import type { SyntheticEvent } from "react";

import Image from "next/image";

import type { ImageProps } from "next/image";

import { useS3Asset } from "@/hooks/useS3Asset";

interface ImageError extends Error {
  statusCode?: number;
}

export interface S3AssetProps extends Omit<ImageProps, "src" | "onError"> {
  url?: string;
  onError?: (error: ImageError) => void;
  alt: string;
  ownerId?: string;
  asVideo?: boolean;
  asBackgroundVideo?: boolean;
  videoClassName?: string;
}

export function S3Asset({
  url,
  onError,
  alt,
  ownerId,
  asVideo = false,
  asBackgroundVideo = false,
  videoClassName,
  ...props
}: S3AssetProps) {
  const {
    url: currentUrl,
    handleAssetError,
    isLoading,
    error,
  } = useS3Asset(url, ownerId);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (error && onError && !error.message.includes("403")) {
      onError(error);
    }
  }, [error, onError]);

  const handleMediaError = (
    e: SyntheticEvent<HTMLImageElement | HTMLVideoElement>
  ) => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount((prev) => prev + 1);
      handleAssetError().catch((error: Error) => {
        // Only log non-403 errors
        if (!error.message.includes("403")) {
          console.error("Failed to refresh asset URL:", error);
        }
      });
    }
  };

  if (!currentUrl) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className="animate-pulse rounded-md bg-gray-200"
        style={{ width: props.width, height: props.height }}
      />
    );
  }

  // Render video element if asVideo is true
  if (asVideo || asBackgroundVideo) {
    return (
      <video
        controls={asVideo && !asBackgroundVideo}
        muted={asBackgroundVideo}
        loop={asBackgroundVideo}
        autoPlay={asBackgroundVideo}
        playsInline={asBackgroundVideo}
        className={videoClassName || (props.className as string)}
        src={currentUrl}
        style={
          asBackgroundVideo
            ? props.style // For background videos, only use custom styles, let CSS classes handle sizing
            : {
                width: props.width,
                height: props.height,
                ...props.style,
              }
        }
        onError={handleMediaError}
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  // Render image element
  return (
    <Image
      {...props}
      unoptimized // Skip Next.js image optimization for S3 URLs
      alt={alt}
      src={currentUrl}
      onError={handleMediaError}
    />
  );
}

// Comparison function for memoization.
const areEqual = (prevProps: S3AssetProps, nextProps: S3AssetProps) => {
  return (
    prevProps.url === nextProps.url &&
    prevProps.alt === nextProps.alt &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.asVideo === nextProps.asVideo &&
    prevProps.asBackgroundVideo === nextProps.asBackgroundVideo
  );
};

export const S3AssetMemoized = memo(S3Asset, areEqual);
