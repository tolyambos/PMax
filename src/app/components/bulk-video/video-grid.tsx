"use client";

import { useState } from "react";
import { useToast } from "@/app/components/ui/use-toast";
import { Card, CardContent } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { 
  Play, 
  Download, 
  RefreshCw, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Clock,
  Loader2,
  Image as ImageIcon,
  Film,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoDetailsModal } from "./video-details-modal";
import { S3Image } from "./s3-image";

interface BulkVideoGridProps {
  videos: any[];
  selectedVideos: string[];
  onSelectionChange: (selected: string[]) => void;
  onVideoUpdate: () => void;
  likedVideos?: Set<string>;
  onLikeToggle?: (videoId: string) => void;
  filterMode?: "all" | "liked" | "rendered";
}

export function BulkVideoGrid({
  videos,
  selectedVideos,
  onSelectionChange,
  onVideoUpdate,
  likedVideos = new Set(),
  onLikeToggle,
  filterMode = "all",
}: BulkVideoGridProps) {
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const { toast } = useToast();

  const toggleSelection = (videoId: string) => {
    if (selectedVideos.includes(videoId)) {
      onSelectionChange(selectedVideos.filter(id => id !== videoId));
    } else {
      onSelectionChange([...selectedVideos, videoId]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
      case "processing":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "failed":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    }
  };

  const getThumbnail = (video: any) => {
    // Try to get thumbnail from first scene
    const firstScene = video.scenes?.[0];
    if (firstScene?.imageUrl) {
      return firstScene.imageUrl;
    }
    // Return placeholder
    return null;
  };

  // Filter videos based on filter mode
  const filteredVideos = videos.filter(video => {
    if (filterMode === "liked") {
      return likedVideos.has(video.id);
    }
    if (filterMode === "rendered") {
      return video.renderedVideos?.some((r: any) => r.status === "completed");
    }
    return true;
  });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVideos.map((video) => {
          const thumbnail = getThumbnail(video);
          const isSelected = selectedVideos.includes(video.id);
          const hasRenderedVideos = video.renderedVideos?.some((r: any) => r.status === "completed");
          const isLiked = likedVideos.has(video.id);
          
          return (
            <Card
              key={video.id}
              className={cn(
                "relative overflow-hidden transition-all hover:shadow-lg",
                isSelected && "ring-2 ring-blue-500"
              )}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(video.id)}
                  className="bg-white/90 dark:bg-gray-800/90 backdrop-blur border-gray-300 dark:border-gray-600"
                />
              </div>

              {/* Status Badge and Like Button */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                {onLikeToggle && (
                  <Button
                    size="sm"
                    variant={isLiked ? "default" : "outline"}
                    className={cn(
                      "h-8 w-8 p-0 transition-all",
                      isLiked 
                        ? "bg-red-500 hover:bg-red-600 border-red-500 text-white" 
                        : "bg-white/90 dark:bg-gray-800/90 backdrop-blur border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLikeToggle(video.id);
                    }}
                  >
                    <Heart className={cn(
                      "w-4 h-4",
                      isLiked 
                        ? "fill-white text-white" 
                        : "text-gray-600 dark:text-gray-300"
                    )} />
                  </Button>
                )}
                <Badge className={cn("flex items-center gap-1", getStatusColor(video.status))}>
                  {getStatusIcon(video.status)}
                  {video.status}
                </Badge>
              </div>

              {/* Thumbnail */}
              <div 
                className="aspect-video bg-gray-100 dark:bg-gray-800 cursor-pointer relative overflow-hidden group"
                onClick={() => setSelectedVideo(video)}
              >
                {thumbnail ? (
                  <S3Image
                    src={thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                    fill
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="secondary" size="sm">
                    View Details
                  </Button>
                </div>

                {/* Scene Count */}
                {video.scenes?.length > 0 && (
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="bg-black/60 dark:bg-black/80 text-white">
                      <Film className="w-3 h-3 mr-1" />
                      {video.scenes.length} scenes
                    </Badge>
                  </div>
                )}

                {/* Format Count */}
                {hasRenderedVideos && (
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="bg-black/60 dark:bg-black/80 text-white">
                      {video.renderedVideos.filter((r: any) => r.status === "completed").length} formats
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                {/* Text Preview */}
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-3">
                  {video.textContent}
                </p>

                {/* Metadata */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                  <div>Row #{video.rowIndex}</div>
                  {video.customFormats?.length > 0 && (
                    <div>Custom formats: {video.customFormats.join(", ")}</div>
                  )}
                  {video.customDuration && (
                    <div>Duration: {video.customDuration}s</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVideo(video);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  {video.status === "completed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const response = await fetch(`/api/bulk-video/regenerate-video`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ videoId: video.id }),
                            });
                            
                            if (!response.ok) throw new Error("Failed to regenerate video");
                            
                            // Show success toast
                            toast({
                              title: "Video regeneration started",
                              description: "The video is being regenerated from scratch.",
                            });
                            
                            // Trigger update immediately
                            onVideoUpdate();
                            
                            // Trigger another update after a short delay to catch status change
                            setTimeout(() => {
                              onVideoUpdate();
                            }, 1000);
                          } catch (error) {
                            console.error("Regeneration failed:", error);
                            toast({
                              title: "Regeneration failed",
                              description: "Failed to start video regeneration.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      
                      {hasRenderedVideos && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              // Get all completed rendered videos
                              const completedVideos = video.renderedVideos?.filter((r: any) => 
                                r.status === "completed" && r.url
                              );
                              if (!completedVideos || completedVideos.length === 0) {
                                console.error("No completed rendered videos found");
                                return;
                              }

                              // If multiple formats, download as zip
                              if (completedVideos.length > 1) {
                                const response = await fetch(`/api/bulk-video/download-all-formats`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ videoId: video.id }),
                                });
                                
                                if (!response.ok) throw new Error("Failed to download videos");
                                
                                const blob = await response.blob();
                                
                                // Extract filename from Content-Disposition header if available
                                const contentDisposition = response.headers.get('content-disposition');
                                let filename = `video-${video.rowIndex}-all-formats.zip`;
                                if (contentDisposition) {
                                  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                                  if (filenameMatch) {
                                    filename = filenameMatch[1];
                                  }
                                }
                                
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              } else {
                                // Single format - direct download
                                const firstRendered = completedVideos[0];
                                const proxyUrl = `/api/bulk-video/proxy-download?id=${firstRendered.id}`;
                                
                                const a = document.createElement("a");
                                a.href = proxyUrl;
                                a.download = `video-${video.rowIndex}-${firstRendered.format.replace("x", "-")}.mp4`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }
                            } catch (error) {
                              console.error("Download failed:", error);
                              toast({
                                title: "Download failed",
                                description: "Failed to download video files.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Video Details Modal */}
      {selectedVideo && (
        <VideoDetailsModal
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onUpdate={onVideoUpdate}
        />
      )}
    </>
  );
}