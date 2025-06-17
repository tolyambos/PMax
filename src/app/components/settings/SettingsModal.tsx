"use client";

import React from "react";
import {
  useSettings,
  AnimationProvider,
} from "@/app/contexts/settings-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Check, Zap, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({
  open,
  onOpenChange,
}: SettingsModalProps) {
  const { animationProvider, setAnimationProvider } = useSettings();

  const providers = [
    {
      id: "bytedance" as AnimationProvider,
      name: "Bytedance Seedance",
      description:
        "Fast, high-quality AI video generation with excellent motion dynamics",
      icon: <Zap className="w-5 h-5" />,
      features: [
        "5-10 second videos",
        "720p resolution",
        "Fast generation",
        "Advanced motion",
      ],
      recommended: true,
      status: "Available",
    },
    {
      id: "runway" as AnimationProvider,
      name: "Runway Gen-4",
      description: "Professional-grade video generation with cinematic quality",
      icon: <Play className="w-5 h-5" />,
      features: [
        "High-end quality",
        "Cinematic effects",
        "Precise control",
        "Professional grade",
      ],
      recommended: false,
      status: "Available",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Animation Generation Settings</DialogTitle>
          <DialogDescription>
            Choose your preferred AI service for generating video animations
            from images.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={cn(
                "relative rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md",
                animationProvider === provider.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => setAnimationProvider(provider.id)}
            >
              {/* Selection indicator */}
              {animationProvider === provider.id && (
                <div className="absolute top-3 right-3">
                  <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Recommended badge */}
              {provider.recommended && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-green-500 hover:bg-green-500">
                    Recommended
                  </Badge>
                </div>
              )}

              <div className="flex items-start space-x-4 mt-2">
                <div className="flex-shrink-0 mt-1">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      animationProvider === provider.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {provider.icon}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{provider.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {provider.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    {provider.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {provider.features.map((feature) => (
                      <Badge
                        key={feature}
                        variant="outline"
                        className="text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Current:{" "}
            <span className="font-medium">
              {providers.find((p) => p.id === animationProvider)?.name}
            </span>
          </div>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
