"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Helper function to refresh S3 URLs
const refreshS3Url = async (url: string): Promise<string> => {
  if (
    !url ||
    (!url.includes("wasabisys.com") &&
      !url.includes("amazonaws.com") &&
      !url.includes("s3."))
  ) {
    console.log("[refreshS3Url] Not an S3 URL, returning as-is:", url);
    return url;
  }

  console.log("[refreshS3Url] Refreshing S3 URL:", url);

  try {
    const response = await fetch("/api/s3/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      const result = await response.json();
      const refreshedUrl = result.presignedUrl || url;
      console.log("[refreshS3Url] Refreshed URL:", refreshedUrl);
      return refreshedUrl;
    } else {
      console.error(
        "[refreshS3Url] API response not OK:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("[refreshS3Url] Error refreshing S3 URL:", error);
  }

  console.log("[refreshS3Url] Falling back to original URL");
  return url;
};

// Check if URL is S3
const isS3Url = (url: string): boolean => {
  return (
    !!url &&
    (url.includes("wasabisys.com") ||
      url.includes("amazonaws.com") ||
      url.includes("s3."))
  );
};

interface S3ImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

// Component to handle S3 image with refresh
export const S3Image = ({
  src,
  alt,
  className,
  style,
  fill,
  width,
  height,
  priority,
  onLoad,
  onError,
}: S3ImageProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      console.log(`[S3Image] Loading image for ${alt} with src:`, src);

      if (!src) {
        console.error(`[S3Image] No src provided for ${alt}`);
        setHasError(true);
        setIsLoading(false);
        onError?.();
        return;
      }

      // Skip non-S3 URLs
      if (!isS3Url(src)) {
        console.log(`[S3Image] Non-S3 URL for ${alt}, using as-is:`, src);
        setImageUrl(src);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const refreshedUrl = await refreshS3Url(src);
        console.log(
          `[S3Image] Setting refreshed URL for ${alt}:`,
          refreshedUrl
        );
        setImageUrl(refreshedUrl);
      } catch (error) {
        console.error(`[S3Image] Error refreshing S3 URL for ${alt}:`, error);
        setHasError(true);
        onError?.();
      }

      setIsLoading(false);
    };

    loadImage();
  }, [src, alt, onError]);

  if (isLoading) {
    console.log(`[S3Image] Showing loading state for ${alt}`);
    return (
      <div 
        className={cn("animate-pulse bg-gray-200", className)} 
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          ...style
        }}
      />
    );
  }

  if (hasError || !imageUrl) {
    console.log(`[S3Image] Showing fallback state for ${alt}`, {
      hasError,
      imageUrl,
      isS3: isS3Url(src),
    });
    return (
      <div 
        className={cn("flex items-center justify-center bg-gray-100", className)}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          ...style
        }}
      >
        <span className="text-gray-400">Failed to load image</span>
      </div>
    );
  }

  console.log(`[S3Image] Rendering image for ${alt} with URL:`, imageUrl);
  
  if (fill) {
    return (
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className={cn("object-contain", className)}
        style={style}
        priority={priority}
        onLoad={onLoad}
        onError={(e) => {
          console.error(`[S3Image] Image load error for ${alt}:`, e);
          setHasError(true);
          onError?.();
        }}
      />
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      onLoad={onLoad}
      onError={(e) => {
        console.error(`[S3Image] Image load error for ${alt}:`, e);
        setHasError(true);
        onError?.();
      }}
    />
  );
};