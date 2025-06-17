"use client";

import { useState } from "react";
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
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { LocalUploadButton } from "./local-upload-button";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void; // Add this prop to allow parent to refresh assets
}

export default function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [activeTab, setActiveTab] = useState("image");
  const { toast } = useToast();

  const handleUploadComplete = (fileUrl: string, assetId: string) => {
    toast({
      title: "Upload complete",
      description: "Your file has been uploaded successfully.",
    });

    // Trigger the parent component to refresh assets
    if (onUploadComplete) {
      onUploadComplete();
    }

    onClose();
  };

  const handleUploadError = (error: string) => {
    toast({
      variant: "destructive",
      title: "Upload failed",
      description:
        error || "There was an error uploading your file. Please try again.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="image"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="py-4">
            <LocalUploadButton
              fileType="image"
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </TabsContent>

          <TabsContent value="video" className="py-4">
            <LocalUploadButton
              fileType="video"
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </TabsContent>

          <TabsContent value="audio" className="py-4">
            <LocalUploadButton
              fileType="audio"
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
