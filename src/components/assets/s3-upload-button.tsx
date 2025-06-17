"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { toast } from "@/app/components/ui/use-toast";

interface S3UploadButtonProps {
  onUploadComplete?: (asset: any) => void;
  onUploadStart?: () => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function S3UploadButton({
  onUploadComplete,
  onUploadStart,
  accept = "image/*,video/*,audio/*",
  multiple = false,
  className,
  children,
}: S3UploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setIsUploading(true);
    onUploadStart?.();

    try {
      for (const file of Array.from(files)) {
        // Upload via direct S3 integration
        const formData = new FormData();
        formData.append("file", file);
        formData.append("assetType", file.type.split("/")[0]); // image, video, audio

        const response = await fetch("/api/s3/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const result = await response.json();

        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded successfully.`,
        });

        onUploadComplete?.(result.asset);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileUpload(files);
    }
    // Reset input to allow re-uploading the same file
    e.target.value = "";
  };

  return (
    <div className={className}>
      <Input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={isUploading}
        className="hidden"
        id="s3-file-upload"
      />
      <Button
        onClick={() => document.getElementById("s3-file-upload")?.click()}
        disabled={isUploading}
        variant="outline"
      >
        {isUploading ? "Uploading..." : children || "Upload to S3"}
      </Button>
    </div>
  );
}
