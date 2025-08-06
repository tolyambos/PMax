"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { useToast } from "@/app/components/ui/use-toast";
import { S3Image } from "./s3-image";
import { S3Video } from "./s3-video";
import { Check, Clock, Image as ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface SceneVersionSelectorProps {
  sceneId: string;
  videoId: string;
  onVersionChange?: () => void;
}

export function SceneVersionSelector({ sceneId, videoId, onVersionChange }: SceneVersionSelectorProps) {
  const { toast } = useToast();
  const [imageVersions, setImageVersions] = useState<any[]>([]);
  const [animationVersions, setAnimationVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const fetchVersions = async () => {
    try {
      const response = await fetch(`/api/bulk-video/scene/${sceneId}/versions`);
      if (!response.ok) throw new Error("Failed to fetch versions");
      
      const data = await response.json();
      setImageVersions(data.imageVersions);
      setAnimationVersions(data.animationVersions);
    } catch (error) {
      console.error("Error fetching versions:", error);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [sceneId]);

  const handleActivateVersion = async (type: 'image' | 'animation', versionId: string) => {
    setActivating(versionId);
    
    try {
      const response = await fetch(`/api/bulk-video/scene/${sceneId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, versionId }),
      });

      if (!response.ok) throw new Error("Failed to activate version");
      
      toast({
        title: "Version activated",
        description: `${type === 'image' ? 'Image' : 'Animation'} version has been activated`,
      });
      
      await fetchVersions();
      onVersionChange?.();
    } catch (error) {
      toast({
        title: "Failed to activate version",
        description: "An error occurred while activating the version",
        variant: "destructive",
      });
    } finally {
      setActivating(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Image Versions */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Image Versions ({imageVersions.length})
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {imageVersions.map((version) => (
            <div
              key={version.id}
              className={cn(
                "relative rounded-lg border p-2 cursor-pointer transition-all",
                version.isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400"
              )}
              onClick={() => !version.isActive && handleActivateVersion('image', version.id)}
            >
              <div className="aspect-square relative mb-2">
                <S3Image
                  src={version.imageUrl}
                  alt={`Version ${version.version}`}
                  className="w-full h-full object-cover rounded"
                />
                {version.isActive && (
                  <Badge className="absolute top-1 right-1 bg-blue-500">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
                {activating === version.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">v{version.version}</span>
                  {version.qualityScore && (
                    <Badge variant="outline" className="text-xs">
                      Score: {version.qualityScore.toFixed(1)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(version.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Animation Versions */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Film className="w-4 h-4" />
          Animation Versions ({animationVersions.length})
        </h4>
        <div className="space-y-3">
          {animationVersions.map((version) => (
            <div
              key={version.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                version.isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400"
              )}
              onClick={() => !version.isActive && handleActivateVersion('animation', version.id)}
            >
              <div className="w-24 h-24 relative flex-shrink-0">
                <S3Video
                  src={version.animationUrl}
                  className="w-full h-full object-cover rounded"
                  controls={false}
                  autoPlay
                  loop
                  muted
                />
                {activating === version.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Version {version.version}</span>
                  {version.isActive && (
                    <Badge className="bg-blue-500">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Badge variant="outline">{version.animationProvider}</Badge>
                  {version.duration && <span>{version.duration}s</span>}
                  <span>{formatDate(version.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {version.animationPrompt}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}