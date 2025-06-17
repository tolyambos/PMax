/* eslint-disable jsx-a11y/alt-text */
"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { X, Upload, Link, Image, FileVideo, Music } from "lucide-react";
import { LocalUploadButton } from "./local-upload-button";

interface EnhancedUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export default function EnhancedUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: EnhancedUploadModalProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [assetType, setAssetType] = useState("image");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUploadComplete = (fileUrl: string, assetId: string) => {
    toast({
      title: "Upload complete",
      description: "Your file has been uploaded successfully.",
    });
    resetForm();
    onClose();
    onUploadComplete?.(); // Call the onUploadComplete callback if provided
  };

  const handleUploadError = (error: string) => {
    toast({
      variant: "destructive",
      title: "Upload failed",
      description:
        error || "There was an error uploading your file. Please try again.",
    });
    setIsUploading(false);
  };

  const handleUrlUpload = async () => {
    if (!url || !name) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide both a URL and a name for your asset.",
      });
      return;
    }

    setIsUploading(true);

    try {
      // In a real implementation, this would make an API call to save the URL asset
      // For MVP, just simulate a network request
      await new Promise((resolve) => setTimeout(resolve, 1200));

      toast({
        title: "Asset added",
        description: `${name} has been added to your library.`,
      });

      resetForm();
      onClose();
      onUploadComplete?.(); // Call the onUploadComplete callback if provided
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to add asset",
        description: "There was an error adding your asset. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setName("");
    setTags("");
    setIsUploading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="upload"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="upload" className="flex gap-2 items-center">
              <Upload className="w-4 h-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex gap-2 items-center">
              <Link className="w-4 h-4" />
              Add from URL
            </TabsTrigger>
          </TabsList>

          <div className="my-4">
            <Label htmlFor="assetType">Asset Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={assetType === "image" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAssetType("image")}
              >
                <Image className="mr-2 w-4 h-4" />
                Image
              </Button>
              <Button
                type="button"
                variant={assetType === "video" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAssetType("video")}
              >
                <FileVideo className="mr-2 w-4 h-4" />
                Video
              </Button>
              <Button
                type="button"
                variant={assetType === "audio" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAssetType("audio")}
              >
                <Music className="mr-2 w-4 h-4" />
                Audio
              </Button>
            </div>
          </div>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <LocalUploadButton
                  fileType={assetType as "image" | "video" | "audio"}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uploadName">Asset Name</Label>
                <Input
                  id="uploadName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My awesome asset"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uploadTags">Tags (comma separated)</Label>
                <Input
                  id="uploadTags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="logo, brand, product"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assetUrl">URL</Label>
                <Input
                  id="assetUrl"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assetName">Asset Name</Label>
                <Input
                  id="assetName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My awesome asset"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assetTags">Tags (comma separated)</Label>
                <Input
                  id="assetTags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="logo, brand, product"
                />
              </div>

              <Button
                onClick={handleUrlUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? "Adding..." : "Add to Library"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
