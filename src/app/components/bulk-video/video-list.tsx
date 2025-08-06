"use client";

import { useState } from "react";
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
  ChevronRight,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoDetailsModal } from "./video-details-modal";

interface BulkVideoListProps {
  videos: any[];
  selectedVideos: string[];
  onSelectionChange: (selected: string[]) => void;
  onVideoUpdate: () => void;
  likedVideos?: Set<string>;
  onLikeToggle?: (videoId: string) => void;
  filterMode?: "all" | "liked" | "rendered";
}

export function BulkVideoList({
  videos,
  selectedVideos,
  onSelectionChange,
  onVideoUpdate,
  likedVideos = new Set(),
  onLikeToggle,
  filterMode = "all",
}: BulkVideoListProps) {
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  const toggleSelection = (videoId: string) => {
    if (selectedVideos.includes(videoId)) {
      onSelectionChange(selectedVideos.filter(id => id !== videoId));
    } else {
      onSelectionChange([...selectedVideos, videoId]);
    }
  };

  const toggleAll = () => {
    if (selectedVideos.length === videos.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(videos.map(v => v.id));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={selectedVideos.length === videos.length && videos.length > 0}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                #
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                Text Content
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                Scenes
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                Formats
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                Custom Settings
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                Like
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredVideos.map((video, index) => {
              const isSelected = selectedVideos.includes(video.id);
              const isLiked = likedVideos.has(video.id);
              const completedScenes = video.scenes?.filter((s: any) => s.status === "completed").length || 0;
              const totalScenes = video.scenes?.length || 0;
              const completedFormats = video.renderedVideos?.filter((r: any) => r.status === "completed").length || 0;
              const customSettingsCount = 
                (video.customFormats?.length ? 1 : 0) +
                (video.customDuration ? 1 : 0) +
                (video.customSceneCount ? 1 : 0) +
                (video.customImageStyle ? 1 : 0) +
                (video.customAnimationProvider ? 1 : 0);

              return (
                <tr
                  key={video.id}
                  className={cn(
                    "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                    isSelected && "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  )}
                >
                  <td className="w-12 px-4 py-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(video.id)}
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {video.rowIndex}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 max-w-md">
                      {video.textContent}
                    </p>
                    {video.productImageUrl && (
                      <Badge variant="outline" className="mt-1">
                        Has product image
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Badge className={cn("flex items-center gap-1 w-fit", getStatusColor(video.status))}>
                      {getStatusIcon(video.status)}
                      {video.status}
                    </Badge>
                    {video.error && (
                      <p className="text-xs text-red-600 mt-1">{video.error}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {totalScenes > 0 ? (
                      <div className="flex items-center gap-2">
                        <span>{completedScenes}/{totalScenes}</span>
                        {completedScenes === totalScenes && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {completedFormats > 0 ? (
                      <Badge variant="secondary">
                        {completedFormats} ready
                      </Badge>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {customSettingsCount > 0 ? (
                      <Badge variant="outline">
                        {customSettingsCount} custom
                      </Badge>
                    ) : (
                      <span className="text-gray-400">Default</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {onLikeToggle && (
                      <Button
                        size="sm"
                        variant={isLiked ? "default" : "ghost"}
                        className={cn(
                          "h-8 w-8 p-0",
                          isLiked ? "bg-red-500 hover:bg-red-600" : ""
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onLikeToggle(video.id);
                        }}
                      >
                        <Heart className={cn("w-4 h-4", isLiked && "fill-white")} />
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedVideo(video)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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