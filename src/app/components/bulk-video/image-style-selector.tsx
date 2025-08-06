"use client";

import { useState } from "react";
import { imageStylePresets, getPresetsByCategory, getPresetById } from "@/app/utils/bulk-video/image-style-presets";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  Sparkles,
  Package,
  Heart,
  Cpu,
  Palette,
  ShirtIcon,
  Coffee,
  Check,
} from "lucide-react";

interface ImageStyleSelectorProps {
  selectedPresetId?: string;
  onPresetSelect: (presetId: string | undefined) => void;
}

const categoryIcons = {
  product: Package,
  lifestyle: Heart,
  tech: Cpu,
  abstract: Palette,
  fashion: ShirtIcon,
  food: Coffee,
};

const categoryNames = {
  product: "Product",
  lifestyle: "Lifestyle",
  tech: "Technology",
  abstract: "Abstract",
  fashion: "Fashion",
  food: "Food & Beverage",
};

export function ImageStyleSelector({
  selectedPresetId,
  onPresetSelect,
}: ImageStyleSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>("product");

  const categories = Object.keys(categoryNames) as Array<keyof typeof categoryNames>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">Style Presets</span>
        </div>
        {selectedPresetId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPresetSelect(undefined)}
            className="text-xs"
          >
            Clear Selection
          </Button>
        )}
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto">
          {categories.map((category) => {
            const Icon = categoryIcons[category];
            return (
              <TabsTrigger
                key={category}
                value={category}
                className="flex flex-col gap-1 h-auto py-2"
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs">{categoryNames[category]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid gap-3">
                {getPresetsByCategory(category).map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() =>
                        onPresetSelect(isSelected ? undefined : preset.id)
                      }
                      className={cn(
                        "relative p-4 rounded-lg border-2 text-left transition-all",
                        "hover:border-blue-400 hover:shadow-md",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "border-gray-200 dark:border-gray-700"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                      
                      <div className="pr-8">
                        <h4 className="font-medium text-sm mb-1">
                          {preset.name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          {preset.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {categoryNames[category]}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {selectedPresetId && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Selected:</strong> {getPresetById(selectedPresetId)?.name}
            <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
              This preset will be combined with your custom style for premium advertising quality.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Tip:</strong> Combine presets with your custom style description for best results. 
          Presets ensure consistent, high-quality advertising photography.
        </p>
      </div>
    </div>
  );
}