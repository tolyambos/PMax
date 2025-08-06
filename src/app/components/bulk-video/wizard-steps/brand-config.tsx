"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Upload, Image as ImageIcon, Move, Ruler, Link, Unlink } from "lucide-react";
import { BulkVideoProjectSettings, LogoPosition } from "@/app/types/bulk-video";
import { cn } from "@/lib/utils";
import { useToast } from "@/app/components/ui/use-toast";
import { S3Image } from "@/app/components/bulk-video/s3-image";

interface BrandConfigStepProps {
  settings: Partial<BulkVideoProjectSettings>;
  onSettingsChange: (settings: Partial<BulkVideoProjectSettings>) => void;
}

const LOGO_POSITIONS: { value: LogoPosition; label: string; icon: string }[] = [
  { value: "top-left", label: "Top Left", icon: "↖️" },
  { value: "top-right", label: "Top Right", icon: "↗️" },
  { value: "bottom-left", label: "Bottom Left", icon: "↙️" },
  { value: "bottom-right", label: "Bottom Right", icon: "↘️" },
  { value: "center", label: "Center", icon: "⊙" },
];

export function BrandConfigStep({
  settings,
  onSettingsChange,
}: BrandConfigStepProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(2); // Default 2:1 ratio

  // Calculate aspect ratio when logo dimensions change
  useEffect(() => {
    if (settings.logoSize?.width && settings.logoSize?.height) {
      const newRatio = settings.logoSize.width / settings.logoSize.height;
      setAspectRatio(newRatio);
    }
  }, [settings.logoSize?.width, settings.logoSize?.height]); // Recalculate when dimensions change
  
  // Load existing logo dimensions on mount if logo already exists
  useEffect(() => {
    if (settings.brandLogoUrl && (!settings.logoSize?.width || settings.logoSize?.width === 120)) {
      // Logo exists but dimensions might be default, recalculate
      const loadImageDimensions = async () => {
        try {
          // Get presigned URL for CORS-safe loading
          const response = await fetch("/api/s3/presigned-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: settings.brandLogoUrl }),
          });
          
          if (response.ok) {
            const { presignedUrl } = await response.json();
            
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const newAspectRatio = img.width / img.height;
              setAspectRatio(newAspectRatio);
              
              // Only update if current dimensions are default
              if (settings.logoSize?.width === 120 && settings.logoSize?.height === 60) {
                const maxWidth = 200;
                const maxHeight = 100;
                let width = img.width;
                let height = img.height;
                
                const scale = Math.max(width / maxWidth, height / maxHeight);
                if (scale > 1) {
                  width = width / scale;
                  height = height / scale;
                }
                
                onSettingsChange({
                  ...settings,
                  logoSize: {
                    width: Math.round(width),
                    height: Math.round(height),
                  },
                });
              }
            };
            img.src = presignedUrl;
          }
        } catch (error) {
          console.error("Failed to load existing logo dimensions:", error);
        }
      };
      
      loadImageDimensions();
    }
  }, [settings.brandLogoUrl]); // Run when component mounts with existing logo

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    // Read image dimensions from file BEFORE upload
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        const imageAspectRatio = originalWidth / originalHeight;
        
        console.log("File image dimensions:", { width: originalWidth, height: originalHeight, ratio: imageAspectRatio });
        
        // Calculate appropriate display size
        const maxWidth = 200;
        const maxHeight = 100;
        let displayWidth = originalWidth;
        let displayHeight = originalHeight;
        
        // Scale down if needed
        if (displayWidth > maxWidth || displayHeight > maxHeight) {
          const scale = Math.max(displayWidth / maxWidth, displayHeight / maxHeight);
          displayWidth = displayWidth / scale;
          displayHeight = displayHeight / scale;
        }
        
        // Store these dimensions for immediate use
        setAspectRatio(imageAspectRatio);
        
        // Continue with upload
        uploadFile(file, Math.round(displayWidth), Math.round(displayHeight));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const uploadFile = async (file: File, calculatedWidth: number, calculatedHeight: number) => {

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload logo");
      }

      const { url } = await response.json();
      
      console.log("Upload response URL:", url);
      console.log("Using pre-calculated dimensions:", { width: calculatedWidth, height: calculatedHeight });
      
      // Update with URL and pre-calculated dimensions
      onSettingsChange({
        ...settings,
        brandLogoUrl: url,
        logoSize: {
          width: calculatedWidth,
          height: calculatedHeight,
        },
      });

      toast({
        title: "Logo uploaded",
        description: "Your brand logo has been uploaded successfully",
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="dark:bg-gray-800/50 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Brand Configuration
        </CardTitle>
        <CardDescription>
          Set up your brand logo and positioning for all videos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-4">
          <Label>Brand Logo <span className="text-red-500">*</span></Label>
          
          {settings.brandLogoUrl ? (
            <div className="relative">
              <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <S3Image
                  src={settings.brandLogoUrl}
                  alt="Brand logo"
                  className="max-h-32 mx-auto"
                  style={{ maxHeight: '8rem' }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => document.getElementById("logo-upload")?.click()}
              >
                Change Logo
              </Button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => document.getElementById("logo-upload")?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Click to upload your brand logo
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PNG, JPG up to 5MB • Recommended: Transparent background
              </p>
            </div>
          )}
          
          <input
            id="logo-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={uploading}
          />
        </div>

        {/* Logo Position */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Move className="w-4 h-4" />
            Logo Position
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {LOGO_POSITIONS.map((position) => (
              <button
                key={position.value}
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    logoPosition: position.value,
                  })
                }
                className={cn(
                  "p-4 rounded-lg border-2 transition-all",
                  "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950",
                  settings.logoPosition === position.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="text-2xl mb-1">{position.icon}</div>
                <div className="text-sm font-medium">{position.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Logo Size */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Logo Size (pixels)
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
              className="flex items-center gap-2 text-sm"
            >
              {maintainAspectRatio ? (
                <>
                  <Link className="w-4 h-4" />
                  <span>Aspect ratio locked</span>
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4" />
                  <span>Aspect ratio unlocked</span>
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="logo-width" className="text-sm text-gray-600 dark:text-gray-400">
                Width
              </Label>
              <Input
                id="logo-width"
                type="number"
                min="50"
                max="500"
                value={settings.logoSize?.width || 120}
                onChange={(e) => {
                  const newWidth = parseInt(e.target.value) || 120;
                  const newHeight = maintainAspectRatio 
                    ? Math.round(newWidth / aspectRatio)
                    : (settings.logoSize?.height || 60);
                  
                  onSettingsChange({
                    ...settings,
                    logoSize: {
                      width: newWidth,
                      height: newHeight,
                    },
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="logo-height" className="text-sm text-gray-600 dark:text-gray-400">
                Height
              </Label>
              <Input
                id="logo-height"
                type="number"
                min="30"
                max="300"
                value={settings.logoSize?.height || 60}
                onChange={(e) => {
                  const newHeight = parseInt(e.target.value) || 60;
                  const newWidth = maintainAspectRatio
                    ? Math.round(newHeight * aspectRatio)
                    : (settings.logoSize?.width || 120);
                  
                  onSettingsChange({
                    ...settings,
                    logoSize: {
                      width: newWidth,
                      height: newHeight,
                    },
                  });
                }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Logo will be automatically scaled to fit these dimensions while maintaining aspect ratio
          </p>
        </div>

        {/* Preview */}
        {settings.brandLogoUrl && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <Label className="text-sm text-gray-600 dark:text-gray-400 mb-3 block">Preview</Label>
            <div className="relative bg-black rounded-lg aspect-video">
              <div
                className={cn(
                  "absolute bg-white/10 backdrop-blur-sm rounded p-2",
                  settings.logoPosition === "top-left" && "top-4 left-4",
                  settings.logoPosition === "top-right" && "top-4 right-4",
                  settings.logoPosition === "bottom-left" && "bottom-4 left-4",
                  settings.logoPosition === "bottom-right" && "bottom-4 right-4",
                  settings.logoPosition === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                )}
                style={{
                  width: `${(settings.logoSize?.width || 120) / 4}px`,
                  height: `${(settings.logoSize?.height || 60) / 4}px`,
                }}
              >
                <S3Image
                  src={settings.brandLogoUrl}
                  alt="Logo preview"
                  className="w-full h-full object-contain"
                  fill
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}