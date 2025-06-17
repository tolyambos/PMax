"use client";

import { useState, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Loader2, Upload } from "lucide-react";

interface LocalUploadButtonProps {
  fileType: "image" | "video" | "audio";
  onUploadComplete: (fileUrl: string, assetId: string) => void;
  onUploadError: (error: string) => void;
}

export function LocalUploadButton({
  fileType,
  onUploadComplete,
  onUploadError,
}: LocalUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptMap = {
    image: "image/*",
    video: "video/*",
    audio: "audio/*",
  };

  const handleButtonClick = () => {
    // Programmatically click the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      onUploadComplete(data.url, data.assetId);
    } catch (error) {
      console.error("Upload error:", error);
      onUploadError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="w-full">
        <Button
          type="button"
          variant="outline"
          className="relative w-full h-24 border-dashed"
          disabled={isUploading}
          onClick={handleButtonClick}
        >
          {isUploading ? (
            <div className="flex gap-2 items-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <Upload className="w-6 h-6" />
              <span>
                Click to{" "}
                {fileType === "image"
                  ? "select an image"
                  : fileType === "video"
                    ? "select a video"
                    : "select an audio file"}
              </span>
            </div>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptMap[fileType]}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>
      {fileType === "image" && (
        <p className="text-xs text-muted-foreground">
          Upload JPG, PNG, GIF, or SVG (max 4MB)
        </p>
      )}
      {fileType === "video" && (
        <p className="text-xs text-muted-foreground">
          Upload MP4, WebM or MOV (max 16MB)
        </p>
      )}
      {fileType === "audio" && (
        <p className="text-xs text-muted-foreground">
          Upload MP3, WAV or OGG (max 8MB)
        </p>
      )}
    </div>
  );
}
