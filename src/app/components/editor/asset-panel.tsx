"use client";

import { useState } from "react";
import AssetLibrary, { Asset } from "@/app/components/assets/asset-library";
import EnhancedUploadButton from "@/app/components/assets/enhanced-upload-button";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AssetPanelProps {
  onAssetAdd?: (asset: Asset) => void;
  isCollapsed?: boolean;
}

export default function AssetPanel({
  onAssetAdd,
  isCollapsed = false,
}: AssetPanelProps) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(isCollapsed);
  const { toast } = useToast();

  const handleAssetSelect = (asset: Asset) => {
    if (onAssetAdd) {
      onAssetAdd(asset);
      toast({
        title: "Asset added",
        description: `${asset.name} added to timeline`,
      });
    }
  };

  if (isPanelCollapsed) {
    return (
      <div className="flex flex-col items-center w-12 h-full border-l bg-background">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 my-2 w-8 h-8"
          onClick={() => setIsPanelCollapsed(false)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex flex-col flex-1 justify-center items-center space-y-4">
          <div className="text-xs font-semibold tracking-wider uppercase rotate-90 text-muted-foreground">
            Assets
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-80 h-full border-l bg-background">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Assets</h2>
        <div className="flex space-x-2">
          <EnhancedUploadButton variant="outline" size="sm" />
          <Button
            variant="ghost"
            size="sm"
            className="p-0 w-8 h-8"
            onClick={() => setIsPanelCollapsed(true)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden flex-1">
        <AssetLibrary onAssetSelect={handleAssetSelect} />
      </div>
    </div>
  );
}
