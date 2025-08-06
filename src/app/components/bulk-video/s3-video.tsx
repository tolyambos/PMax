"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface S3VideoProps {
  src: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  onError?: () => void;
}

export function S3Video({
  src,
  className,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  onError,
}: S3VideoProps) {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVideo = async () => {
      if (!src) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        // Check if this is an S3 URL that needs a presigned URL
        if (src.includes("wasabisys.com") || src.includes("amazonaws.com") || src.includes("s3.")) {
          const response = await fetch("/api/s3/refresh-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: src }),
          });

          if (!response.ok) {
            throw new Error("Failed to get presigned URL");
          }

          const data = await response.json();
          if (isMounted) {
            setVideoUrl(data.url);
          }
        } else {
          // Not an S3 URL, use as is
          if (isMounted) {
            setVideoUrl(src);
          }
        }
      } catch (err) {
        console.error("Error loading video:", err);
        if (isMounted) {
          setError(true);
          onError?.();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadVideo();

    // Refresh presigned URL every 6 days (before 7-day expiry)
    const interval = setInterval(loadVideo, 6 * 24 * 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [src, onError]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-100 dark:bg-gray-800", className)}>
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-100 dark:bg-gray-800", className)}>
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load video</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      onError={() => {
        setError(true);
        onError?.();
      }}
    />
  );
}