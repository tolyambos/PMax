"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Asset } from "@/app/components/assets/asset-library";
import AssetLibrary from "@/app/components/assets/asset-library";
import EnhancedUploadButton from "@/app/components/assets/enhanced-upload-button";
import { Element } from "./../types";
import { Image as ImageIcon } from "lucide-react";

interface LogoElementEditorProps {
  selectedElement?: Element;
  sceneId: string;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onAddElement?: (elementConfig: any) => void;
  isEditMode: boolean;
}

export default function LogoElementEditor({
  selectedElement,
  sceneId,
  onUpdateElement,
  onAddElement,
  isEditMode,
}: LogoElementEditorProps) {
  // Logo/image element state
  const [elementOpacity, setElementOpacity] = useState<number>(1.0);
  const [elementRotation, setElementRotation] = useState<number>(0);
  const [elementWidth, setElementWidth] = useState<number>(20);
  const [elementHeight, setElementHeight] = useState<number>(20);
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);

  // Initialize state from selected element if present
  useEffect(() => {
    if (
      selectedElement &&
      (selectedElement.type === "logo" || selectedElement.type === "image")
    ) {
      // Set opacity
      if (selectedElement.opacity !== undefined) {
        setElementOpacity(Number(selectedElement.opacity));
      }

      // Set rotation
      if (selectedElement.rotation !== undefined) {
        setElementRotation(Number(selectedElement.rotation));
      }

      // Set width and height
      if (selectedElement.width !== undefined) {
        setElementWidth(Number(selectedElement.width));
      }

      if (selectedElement.height !== undefined) {
        setElementHeight(Number(selectedElement.height));
      }
    }
  }, [selectedElement?.id]);

  // Add logo element
  const handleAddLogo = () => {
    // Open the logo selection dialog
    setIsLogoDialogOpen(true);
  };

  // Handle logo selection from asset library
  const handleLogoSelect = (asset: Asset) => {
    if (!onAddElement) return;

    onAddElement({
      type: "logo",
      assetId: asset.id,
      url: asset.url,
      x: Math.round(10), // Top left area
      y: Math.round(10), // Top left area
      width: Math.round(15),
      height: Math.round(15),
      rotation: 0,
      opacity: 1,
      zIndex: 30,
    });

    // Close the dialog after selection
    setIsLogoDialogOpen(false);
  };

  // Update opacity
  const handleOpacityChange = (opacity: number) => {
    setElementOpacity(opacity);

    if (selectedElement && onUpdateElement) {
      onUpdateElement(sceneId, selectedElement.id, {
        opacity: opacity,
      });
    }
  };

  // Update rotation
  const handleRotationChange = (rotation: number) => {
    setElementRotation(rotation);

    if (selectedElement && onUpdateElement) {
      onUpdateElement(sceneId, selectedElement.id, {
        rotation: rotation,
      });
    }
  };

  // Update size
  const handleSizeChange = (width: number, height: number) => {
    setElementWidth(width);
    setElementHeight(height);

    if (selectedElement && onUpdateElement) {
      onUpdateElement(sceneId, selectedElement.id, {
        width: width,
        height: height,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Size Controls */}
      <div className="space-y-2">
        <Label>Size</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Width (%)</Label>
            <Slider
              id="element-width"
              min={5}
              max={100}
              step={1}
              value={[elementWidth]}
              onValueChange={(value) => {
                const newWidth = value[0];
                handleSizeChange(newWidth, elementHeight);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Height (%)</Label>
            <Slider
              id="element-height"
              min={5}
              max={100}
              step={1}
              value={[elementHeight]}
              onValueChange={(value) => {
                const newHeight = value[0];
                handleSizeChange(elementWidth, newHeight);
              }}
            />
          </div>
        </div>
      </div>

      {/* Rotation Control */}
      <div className="space-y-2">
        <Label>Rotation (degrees)</Label>
        <div className="flex items-center space-x-2">
          <Slider
            id="element-rotation"
            min={0}
            max={360}
            step={1}
            value={[elementRotation]}
            onValueChange={(value) => {
              const newRotation = value[0];
              handleRotationChange(newRotation);
            }}
          />
          <span className="w-10 text-sm font-medium text-right">
            {elementRotation}°
          </span>
        </div>
      </div>

      {/* Opacity Control */}
      <div className="space-y-2">
        <Label>Opacity: {elementOpacity.toFixed(1)}</Label>
        <Slider
          id="element-opacity"
          min={0.1}
          max={1.0}
          step={0.1}
          value={[elementOpacity]}
          onValueChange={(value) => {
            const newOpacity = value[0];
            handleOpacityChange(newOpacity);
          }}
        />
      </div>

      {/* Change Image/Logo Button - only shown in edit mode */}
      {isEditMode && (
        <Button
          onClick={() => setIsLogoDialogOpen(true)}
          variant="outline"
          className="w-full"
        >
          <ImageIcon className="mr-2 w-4 h-4" />
          Change Image
        </Button>
      )}

      {/* Only show Add button in add mode */}
      {!isEditMode && (
        <Button onClick={handleAddLogo} className="mt-4 w-full">
          <ImageIcon className="mr-2 w-4 h-4" />
          Select Image/Logo
        </Button>
      )}

      {/* Logo Selection Dialog */}
      <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select Image or Logo</DialogTitle>
          </DialogHeader>

          <div className="flex justify-end mb-2">
            <EnhancedUploadButton variant="outline" size="sm" />
          </div>

          <div className="h-[400px] overflow-y-auto border rounded">
            <AssetLibrary
              onAssetSelect={(asset) => {
                if (isEditMode && selectedElement && onUpdateElement) {
                  // Update the existing element with new image
                  onUpdateElement(sceneId, selectedElement.id, {
                    assetId: asset.id,
                    url: asset.url,
                  });
                  setIsLogoDialogOpen(false);
                } else {
                  // Add new element
                  handleLogoSelect(asset);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
