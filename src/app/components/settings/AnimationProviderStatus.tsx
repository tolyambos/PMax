"use client";

import React, { useEffect, useState } from "react";
import { useSettings } from "@/app/contexts/settings-context";
import { Badge } from "@/app/components/ui/badge";
import { Zap, Play, Check, X } from "lucide-react";

export default function AnimationProviderStatus() {
  const { animationProvider } = useSettings();
  const [providerStatus, setProviderStatus] = useState<{
    [key: string]: { available: boolean; name: string };
  }>({});

  useEffect(() => {
    // Check provider status on mount
    const checkStatus = async () => {
      try {
        // Check Bytedance
        const bytedanceResponse = await fetch("/api/animation/bytedance");
        const bytedanceAvailable = bytedanceResponse.ok;

        // Check Runway
        const runwayResponse = await fetch("/api/animation/generate");
        const runwayAvailable = runwayResponse.ok;

        setProviderStatus({
          bytedance: {
            available: bytedanceAvailable,
            name: "Bytedance Seedance",
          },
          runway: { available: runwayAvailable, name: "Runway Gen-4" },
        });
      } catch (error) {
        console.error("Failed to check provider status:", error);
      }
    };

    checkStatus();
  }, []);

  const currentProvider = providerStatus[animationProvider];

  if (!currentProvider) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        {animationProvider === "bytedance" ? (
          <Zap className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span>{currentProvider.name}</span>
      </div>
      <Badge
        variant={currentProvider.available ? "default" : "destructive"}
        className="text-xs"
      >
        {currentProvider.available ? (
          <>
            <Check className="w-3 h-3 mr-1" />
            Available
          </>
        ) : (
          <>
            <X className="w-3 h-3 mr-1" />
            Unavailable
          </>
        )}
      </Badge>
    </div>
  );
}
