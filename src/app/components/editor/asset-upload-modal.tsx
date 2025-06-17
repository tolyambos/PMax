"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { useToast } from "@/app/components/ui/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Input } from "@/app/components/ui/input";

interface AssetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (assets: any[]) => void;
}

export default function AssetUploadModal({
  isOpen,
  onClose,
  onUpload,
}: AssetUploadModalProps) {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState<"image" | "video" | "audio">(
    "image"
  );
  const [assetName, setAssetName] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);

      // Try to set asset type based on the first file
      const firstFile = fileArray[0];
      if (firstFile.type.startsWith("image/")) {
        setAssetType("image");
      } else if (firstFile.type.startsWith("video/")) {
        setAssetType("video");
      } else if (firstFile.type.startsWith("audio/")) {
        setAssetType("audio");
      }

      // Set asset name from first file
      setAssetName(firstFile.name.split(".")[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileArray = Array.from(e.dataTransfer.files);
      setFiles(fileArray);

      // Try to set asset type based on the first file
      const firstFile = fileArray[0];
      if (firstFile.type.startsWith("image/")) {
        setAssetType("image");
      } else if (firstFile.type.startsWith("video/")) {
        setAssetType("video");
      } else if (firstFile.type.startsWith("audio/")) {
        setAssetType("audio");
      }

      // Set asset name from first file
      setAssetName(firstFile.name.split(".")[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    setIsUploading(true);

    try {
      // In a real implementation, we would upload the files to a server/S3
      // For this demo, we'll just create mock assets
      let uploadedAssets: Array<{
        id: string;
        name: string;
        type: "image" | "video" | "audio";
        url: string;
        thumbnail: string;
        tags: string[];
        createdAt: Date;
        size?: number;
      }> = [];

      if (tab === "upload" && files.length > 0) {
        // Create mock assets based on files
        uploadedAssets = files.map((file, index) => {
          const id = `asset-${Date.now()}-${index}`;
          const fileType = file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
              ? "video"
              : "audio";

          // Create object URLs for demo purposes
          const url = URL.createObjectURL(file);
          const thumbnailUrl =
            fileType === "image"
              ? url
              : `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/300/300`;

          return {
            id,
            name: file.name,
            type: fileType,
            url,
            thumbnail: thumbnailUrl,
            tags: tags.split(",").map((tag) => tag.trim()),
            createdAt: new Date(),
            size: file.size,
          };
        });
      } else if (tab === "url" && assetUrl) {
        // Create mock asset from URL
        const id = `asset-${Date.now()}`;
        uploadedAssets = [
          {
            id,
            name: assetName || `Asset ${id}`,
            type: assetType,
            url: assetUrl,
            thumbnail:
              assetType === "image"
                ? assetUrl
                : `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/300/300`,
            tags: tags.split(",").map((tag) => tag.trim()),
            createdAt: new Date(),
          },
        ];
      }

      if (uploadedAssets.length > 0) {
        onUpload(uploadedAssets);
        toast({
          title: "Assets uploaded",
          description: `Successfully uploaded ${uploadedAssets.length} asset(s)`,
        });

        // Reset form
        setFiles([]);
        setAssetUrl("");
        setAssetName("");
        setTags("");
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: "Please select files or enter a URL",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading your assets",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Upload Assets</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="upload"
          value={tab}
          onValueChange={(v) => setTab(v as "upload" | "url")}
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
            <TabsTrigger value="url">From URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="py-4 space-y-4">
            <div
              className="p-8 text-center rounded-md border-2 border-dashed transition-colors cursor-pointer hover:bg-muted"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFilesSelected}
              />
              <div className="flex flex-col items-center">
                <svg
                  className="mb-2 w-12 h-12 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mb-1 text-sm text-muted-foreground">
                  Drag and drop files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports images, videos, and audio files
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mt-4">
                <Label>Selected Files ({files.length})</Label>
                <ul className="overflow-y-auto mt-2 space-y-1 max-h-32 text-sm">
                  {files.map((file, index) => (
                    <li
                      key={index}
                      className="flex justify-between items-center p-2 rounded bg-muted/50"
                    >
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="py-4 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assetUrl">Asset URL</Label>
                <Input
                  id="assetUrl"
                  type="url"
                  placeholder="https://example.com/your-asset.jpg"
                  value={assetUrl}
                  onChange={(e) => setAssetUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assetType">Asset Type</Label>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant={assetType === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAssetType("image")}
                  >
                    Image
                  </Button>
                  <Button
                    type="button"
                    variant={assetType === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAssetType("video")}
                  >
                    Video
                  </Button>
                  <Button
                    type="button"
                    variant={assetType === "audio" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAssetType("audio")}
                  >
                    Audio
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assetName">Asset Name</Label>
            <Input
              id="assetName"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="Enter asset name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="product, marketing, logo"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              isUploading ||
              (tab === "upload" && files.length === 0) ||
              (tab === "url" && !assetUrl)
            }
          >
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
