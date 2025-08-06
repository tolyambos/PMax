"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { Badge } from "@/app/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Progress } from "@/app/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Play,
  Settings,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Grid3X3,
  List,
  Heart,
  Filter,
  Sparkles,
  RotateCw,
} from "lucide-react";
import { BulkVideoGrid } from "@/app/components/bulk-video/video-grid";
import { BulkVideoList } from "@/app/components/bulk-video/video-list";
import { ProjectSettings } from "@/app/components/bulk-video/project-settings";
import { GenerationProgress } from "@/app/components/bulk-video/generation-progress";

interface BulkVideoProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    brandLogoUrl: string;
    logoPosition: string;
    logoSize: { width: number; height: number };
    defaultFormats: string[];
    defaultDuration: number;
    defaultSceneCount: number;
    defaultAnimationProvider: string;
  };
  stats: {
    totalVideos: number;
    completedVideos: number;
    failedVideos: number;
    pendingVideos: number;
    processingVideos: number;
    totalRenderedFiles: number;
  };
  videos: any[];
}

export default function BulkVideoManagementPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const projectId = params.id as string;

  const [project, setProject] = useState<BulkVideoProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [generationStatus, setGenerationStatus] = useState<any>(null);
  const [renderStatus, setRenderStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("videos");
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "liked" | "rendered">(
    "all"
  );
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [postCompletionRefreshes, setPostCompletionRefreshes] = useState(0);

  // Fetch project data
  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/bulk-video/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");

      const data = await response.json();
      setProject(data.project);
    } catch (error) {
      console.error("Error fetching project:", error);
      toast({
        title: "Error",
        description: "Failed to load project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check generation status
  const checkGenerationStatus = async () => {
    try {
      const response = await fetch(
        `/api/bulk-video/generate?projectId=${projectId}`
      );
      if (!response.ok) return;

      const status = await response.json();
      console.log("Generation status:", status);
      setGenerationStatus(status);

      // Return true if still generating
      return status.status === "generating";
    } catch (error) {
      console.error("Error checking generation status:", error);
      return false;
    }
  };

  // Check render status
  const checkRenderStatus = async () => {
    try {
      const response = await fetch(
        `/api/bulk-video/render-status?projectId=${projectId}`
      );
      if (!response.ok) return false;

      const status = await response.json();
      console.log("Render status:", status);
      setRenderStatus(status);

      // Return true if still rendering
      return status.isRendering;
    } catch (error) {
      console.error("Error checking render status:", error);
      return false;
    }
  };

  // Combined status polling
  const pollStatuses = () => {
    if (isPolling) return; // Prevent multiple polling loops

    setIsPolling(true);

    const pollInterval = setInterval(async () => {
      const [isGenerating, isRendering] = await Promise.all([
        checkGenerationStatus(),
        checkRenderStatus(),
      ]);

      // Refresh project data periodically while operations are active
      if (isGenerating || isRendering) {
        await fetchProject();
        setPostCompletionRefreshes(0); // Reset counter when actively processing
      } else {
        // Continue polling for a few cycles after completion to ensure all data is updated
        if (postCompletionRefreshes < 3) {
          await fetchProject();
          setPostCompletionRefreshes(prev => prev + 1);
          console.log(`Post-completion refresh ${postCompletionRefreshes + 1}/3`);
        } else {
          // Stop polling after extra refreshes
          clearInterval(pollInterval);
          setIsPolling(false);
          setPostCompletionRefreshes(0);
          
          // Final refresh to ensure we have the latest data
          await fetchProject();
          
          // One more refresh after a delay to catch any stragglers
          setTimeout(async () => {
            await fetchProject();
          }, 2000);
        }
      }
    }, 3000); // Poll every 3 seconds

    // Store interval ID for cleanup
    (window as any).bulkVideoPollingInterval = pollInterval;
  };

  useEffect(() => {
    fetchProject();

    // Initial status checks
    Promise.all([checkGenerationStatus(), checkRenderStatus()]).then(
      ([isGenerating, isRendering]) => {
        // Start polling if any operations are active
        if (isGenerating || isRendering) {
          pollStatuses();
        }
      }
    );

    // Cleanup function
    return () => {
      setIsPolling(false);
      // Clear any existing polling interval
      if ((window as any).bulkVideoPollingInterval) {
        clearInterval((window as any).bulkVideoPollingInterval);
        delete (window as any).bulkVideoPollingInterval;
      }
    };
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProject();

    // Check both statuses
    const [isGenerating, isRendering] = await Promise.all([
      checkGenerationStatus(),
      checkRenderStatus(),
    ]);

    // Start polling if needed
    if ((isGenerating || isRendering) && !isPolling) {
      pollStatuses();
    }

    setRefreshing(false);
  };

  // Toggle like status for a video
  const toggleLike = (videoId: string) => {
    setLikedVideos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  // Bulk render selected or all videos
  const handleBulkRender = async (mode: "missing" | "all") => {
    try {
      setBulkOperationLoading(true);
      const videosToRender =
        selectedVideos.length > 0
          ? selectedVideos
          : project?.videos
              .filter((v) => v.status === "completed")
              .map((v) => v.id) || [];

      if (videosToRender.length === 0) {
        toast({
          title: "No videos to render",
          description: "Please select completed videos to render",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/bulk-video/bulk-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          videoIds: videosToRender,
          mode, // "missing" or "all"
        }),
      });

      if (!response.ok) throw new Error("Failed to start bulk render");

      toast({
        title: "Bulk render started",
        description: `Rendering ${videosToRender.length} videos (${mode === "missing" ? "missing formats only" : "all formats"})`,
      });

      // Start polling for render progress after a short delay
      // to ensure render records are created in the database
      setTimeout(async () => {
        // Do an immediate check first
        await checkRenderStatus();
        await fetchProject();

        // Then start polling
        if (!isPolling) {
          pollStatuses();
        }
      }, 500);
    } catch (error) {
      toast({
        title: "Render failed",
        description: "Failed to start bulk render",
        variant: "destructive",
      });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  // Bulk regenerate selected videos
  const handleBulkRegenerate = async () => {
    try {
      setBulkOperationLoading(true);
      const videosToRegenerate =
        selectedVideos.length > 0 ? selectedVideos : [];

      if (videosToRegenerate.length === 0) {
        toast({
          title: "No videos selected",
          description: "Please select videos to regenerate",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/bulk-video/bulk-regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          videoIds: videosToRegenerate,
        }),
      });

      if (!response.ok) throw new Error("Failed to start bulk regeneration");

      toast({
        title: "Bulk regeneration started",
        description: `Regenerating ${videosToRegenerate.length} videos`,
      });

      // Clear selection
      setSelectedVideos([]);

      // Start polling for generation progress
      setTimeout(() => {
        if (!isPolling) {
          pollStatuses();
        }
      }, 1000);
    } catch (error) {
      toast({
        title: "Regeneration failed",
        description: "Failed to start bulk regeneration",
        variant: "destructive",
      });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  // Download liked or rendered videos only
  const handleFilteredDownload = async (filter: "liked" | "rendered") => {
    try {
      setBulkOperationLoading(true);

      let videosToDownload: string[] = [];

      if (filter === "liked") {
        videosToDownload = Array.from(likedVideos);
      } else if (filter === "rendered") {
        videosToDownload =
          project?.videos
            .filter((v) =>
              v.renderedVideos?.some((r: any) => r.status === "completed")
            )
            .map((v) => v.id) || [];
      }

      if (videosToDownload.length === 0) {
        toast({
          title: "No videos to download",
          description: `No ${filter} videos found`,
          variant: "destructive",
        });
        return;
      }

      // Use zip download for multiple videos
      const params = `?videoIds=${videosToDownload.join(",")}`;
      const response = await fetch(`/api/bulk-video/download${params}`);

      if (!response.ok) throw new Error("Failed to download videos");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name || "bulk-videos"}-${filter}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${videosToDownload.length} ${filter} videos`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download videos",
        variant: "destructive",
      });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkDownload = async () => {
    try {
      // Get download URLs first
      const videosToDownload =
        selectedVideos.length > 0
          ? selectedVideos
          : project?.videos.map((v) => v.id) || [];

      if (videosToDownload.length === 0) {
        toast({
          title: "No videos to download",
          description:
            "Please select videos or ensure videos have been rendered",
          variant: "destructive",
        });
        return;
      }

      // For single video, download directly
      if (videosToDownload.length === 1) {
        const response = await fetch("/api/bulk-video/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoIds: videosToDownload }),
        });

        if (!response.ok) throw new Error("Failed to get download URLs");

        const { videos } = await response.json();
        if (videos.length > 0) {
          // Open all videos in new tabs for download
          videos.forEach((video: any) => {
            const a = document.createElement("a");
            a.href = video.url;
            a.download = video.filename;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
        }
      } else {
        // For multiple videos, use zip download
        const params = `?videoIds=${videosToDownload.join(",")}`;
        const response = await fetch(`/api/bulk-video/download${params}`);

        if (!response.ok) throw new Error("Failed to download videos");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project?.name || "bulk-videos"}-export.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: "Download started",
        description:
          videosToDownload.length === 1
            ? "Your video is downloading"
            : `Downloading ${videosToDownload.length} videos`,
      });
    } catch (error) {
      console.error("Error downloading videos:", error);
      toast({
        title: "Download failed",
        description: "Failed to download videos",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateSelected = async () => {
    if (selectedVideos.length === 0) return;

    toast({
      title: "Regenerating videos",
      description: `Regenerating ${selectedVideos.length} videos...`,
    });

    // TODO: Implement batch regeneration
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-gray-600 animate-spin dark:text-gray-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="mb-4 text-lg text-gray-600 dark:text-gray-400">
          Project not found
        </p>
        <Button onClick={() => router.push("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const isGenerating =
    project.stats.pendingVideos > 0 || project.stats.processingVideos > 0;
  const progress =
    project.stats.totalVideos > 0
      ? (project.stats.completedVideos / project.stats.totalVideos) * 100
      : 0;

  // Filter videos based on filter mode
  const filteredVideos = project.videos.filter((video) => {
    if (filterMode === "liked") {
      return likedVideos.has(video.id);
    }
    if (filterMode === "rendered") {
      return video.renderedVideos?.some((r: any) => r.status === "completed");
    }
    return true;
  });

  // Calculate missing renders count and total formats
  const calculateRenderStats = () => {
    let missingCount = 0;
    let totalExpectedRenders = 0;
    let actualRenderedCount = 0;
    const completedVideos = project.videos.filter(
      (v) => v.status === "completed"
    );
    const defaultFormats = project.settings?.defaultFormats || ["9x16"];

    const videoStats: any[] = [];

    completedVideos.forEach((video) => {
      console.log(`Analyzing video ${video.rowIndex}:`, {
        customFormats: video.customFormats,
        renderedVideos: video.renderedVideos,
        defaultFormats: defaultFormats,
      });

      // Get the formats this video should have
      const expectedFormats =
        video.customFormats?.length > 0 ? video.customFormats : defaultFormats;

      // Get successfully rendered formats for this video
      const renderedFormats =
        video.renderedVideos
          ?.filter(
            (r: any) => r.status === "completed" && (r.videoUrl || r.url)
          )
          .map((r: any) => r.format) || [];

      // Find missing formats for this video
      const missingFormats = expectedFormats.filter(
        (format: string) => !renderedFormats.includes(format)
      );

      totalExpectedRenders += expectedFormats.length;
      actualRenderedCount += renderedFormats.length;
      missingCount += missingFormats.length;

      videoStats.push({
        videoId: video.id,
        rowIndex: video.rowIndex,
        expectedFormats: expectedFormats,
        renderedFormats,
        missingFormats,
        hasAllFormats: missingFormats.length === 0,
        customFormats: video.customFormats,
      });
    });

    console.log("Video render stats:", videoStats);
    console.log(`Total expected renders: ${totalExpectedRenders}`);
    console.log(`Actually rendered: ${actualRenderedCount}`);
    console.log(`Missing renders: ${missingCount}`);

    return {
      missingCount,
      totalExpectedRenders,
      actualRenderedCount,
      completedVideosCount: completedVideos.length,
      videoStats,
    };
  };

  const renderStats = calculateRenderStats();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="container px-4 py-4 mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/projects")}
                className="flex gap-2 items-center"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="flex gap-2 items-center text-2xl font-bold text-gray-900 dark:text-white">
                  <FileSpreadsheet className="w-6 h-6" />
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDownload}
                disabled={project.stats.totalRenderedFiles === 0}
              >
                <Download className="mr-2 w-4 h-4" />
                Download All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="container px-4 py-4 mx-auto">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.stats.totalVideos}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Videos
              </div>
            </div>
            <div className="text-center">
              <div className="flex gap-1 justify-center items-center text-2xl font-bold text-green-600">
                <CheckCircle className="w-5 h-5" />
                {project.stats.completedVideos}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Completed
              </div>
            </div>
            <div className="text-center">
              <div className="flex gap-1 justify-center items-center text-2xl font-bold text-blue-600">
                <Clock className="w-5 h-5" />
                {project.stats.processingVideos}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Processing
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {project.stats.pendingVideos}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pending
              </div>
            </div>
            <div className="text-center">
              <div className="flex gap-1 justify-center items-center text-2xl font-bold text-red-600">
                <XCircle className="w-5 h-5" />
                {project.stats.failedVideos}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Failed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.stats.totalRenderedFiles}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Rendered Files
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      {isGenerating && (
        <div className="bg-blue-50 border-b border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <div className="container px-4 py-4 mx-auto">
            <GenerationProgress
              progress={progress}
              currentVideo={generationStatus?.progress?.currentVideo}
              estimatedTime={generationStatus?.estimatedTime}
            />
          </div>
        </div>
      )}

      {/* Render Progress */}
      {renderStatus?.isRendering &&
        renderStatus?.renderProgress?.totalRenders > 0 && (
          <div className="bg-purple-50 border-b border-purple-200 dark:bg-purple-900/20 dark:border-purple-800">
            <div className="container px-4 py-4 mx-auto">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2 items-center">
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin dark:text-purple-400" />
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      Rendering Videos
                    </span>
                  </div>
                  <span className="text-sm text-purple-600 dark:text-purple-400">
                    {renderStatus.renderProgress.completedRenders} /{" "}
                    {renderStatus.renderProgress.totalRenders} formats completed
                  </span>
                </div>
                {renderStatus.renderProgress.currentRenders?.length > 0 && (
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    Currently rendering:{" "}
                    {renderStatus.renderProgress.currentRenders
                      .map((r: any) => `Row ${r.videoIndex} (${r.format})`)
                      .join(", ")}
                  </div>
                )}
                <Progress
                  value={
                    renderStatus.renderProgress.totalRenders > 0
                      ? (renderStatus.renderProgress.completedRenders /
                          renderStatus.renderProgress.totalRenders) *
                        100
                      : 0
                  }
                  className="h-2 bg-purple-200 dark:bg-purple-900"
                />
              </div>
            </div>
          </div>
        )}

      {/* Main Content */}
      <div className="container px-4 py-6 mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {activeTab === "videos" && (
              <div className="flex gap-2 items-center w-full">
                {/* Left side: Selection controls */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const allVideoIds = filteredVideos.map((v) => v.id);
                    if (selectedVideos.length === allVideoIds.length) {
                      setSelectedVideos([]);
                    } else {
                      setSelectedVideos(allVideoIds);
                    }
                  }}
                >
                  {selectedVideos.length === filteredVideos.length &&
                  filteredVideos.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </Button>

                {selectedVideos.length > 0 && (
                  <>
                    <Badge variant="secondary">
                      {selectedVideos.length} selected
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedVideos([])}
                    >
                      Clear Selection
                    </Button>
                  </>
                )}

                {/* Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 w-4 h-4" />
                      {filterMode === "all"
                        ? "All"
                        : filterMode === "liked"
                          ? "Liked"
                          : "Rendered"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setFilterMode("all")}>
                      All Videos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterMode("liked")}>
                      Liked Only
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterMode("rendered")}>
                      Rendered Only
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View mode toggle */}
                <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600">
                  <Button
                    size="sm"
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                    className="rounded-l-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                {/* Spacer to push bulk actions to the right */}
                <div className="flex-1" />

                {/* Right side: Bulk Operations - More prominent */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="default"
                      size="default"
                      className="font-medium shadow-lg bg-primary hover:bg-primary/90"
                    >
                      <Sparkles className="mr-2 w-4 h-4" />
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem
                      onClick={() => handleBulkRender("missing")}
                      disabled={
                        bulkOperationLoading || renderStats.missingCount === 0
                      }
                      className="text-sm"
                    >
                      <Play className="flex-shrink-0 mr-2 w-4 h-4" />
                      <span className="flex-1">Render Missing Formats</span>
                      <Badge variant="secondary" className="ml-2">
                        {renderStats.missingCount}
                      </Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleBulkRender("all")}
                      disabled={
                        bulkOperationLoading ||
                        renderStats.completedVideosCount === 0
                      }
                      className="text-sm"
                    >
                      <Play className="flex-shrink-0 mr-2 w-4 h-4" />
                      <span className="flex-1">Re-render All Formats</span>
                      <Badge variant="secondary" className="ml-2">
                        {renderStats.totalExpectedRenders}
                      </Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBulkRegenerate}
                      disabled={
                        selectedVideos.length === 0 || bulkOperationLoading
                      }
                      className="text-sm"
                    >
                      <RotateCw className="flex-shrink-0 mr-2 w-4 h-4" />
                      <span className="flex-1">Regenerate Selected Videos</span>
                      <Badge variant="secondary" className="ml-2">
                        {selectedVideos.length}
                      </Badge>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleFilteredDownload("liked")}
                      disabled={likedVideos.size === 0 || bulkOperationLoading}
                      className="text-sm"
                    >
                      <Heart className="flex-shrink-0 mr-2 w-4 h-4" />
                      <span className="flex-1">Download Liked</span>
                      <Badge variant="secondary" className="ml-2">
                        {likedVideos.size}
                      </Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleFilteredDownload("rendered")}
                      disabled={
                        bulkOperationLoading ||
                        project.stats.totalRenderedFiles === 0
                      }
                      className="text-sm"
                    >
                      <Download className="flex-shrink-0 mr-2 w-4 h-4" />
                      <span className="flex-1">Download Rendered</span>
                      <Badge variant="secondary" className="ml-2">
                        {project.stats.totalRenderedFiles}
                      </Badge>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <TabsContent value="videos">
            {viewMode === "grid" ? (
              <BulkVideoGrid
                videos={project.videos}
                selectedVideos={selectedVideos}
                onSelectionChange={setSelectedVideos}
                onVideoUpdate={async () => {
                  await fetchProject();
                  // Check if generation or rendering is happening and start polling
                  const [isGen, isRend] = await Promise.all([
                    checkGenerationStatus(),
                    checkRenderStatus(),
                  ]);
                  if ((isGen || isRend) && !isPolling) {
                    pollStatuses();
                  }
                }}
                likedVideos={likedVideos}
                onLikeToggle={toggleLike}
                filterMode={filterMode}
              />
            ) : (
              <BulkVideoList
                videos={project.videos}
                selectedVideos={selectedVideos}
                onSelectionChange={setSelectedVideos}
                onVideoUpdate={async () => {
                  await fetchProject();
                  // Check if generation or rendering is happening and start polling
                  const [isGen, isRend] = await Promise.all([
                    checkGenerationStatus(),
                    checkRenderStatus(),
                  ]);
                  if ((isGen || isRend) && !isPolling) {
                    pollStatuses();
                  }
                }}
                likedVideos={likedVideos}
                onLikeToggle={toggleLike}
                filterMode={filterMode}
              />
            )}
          </TabsContent>

          <TabsContent value="settings">
            <ProjectSettings
              project={project}
              onUpdate={() => fetchProject()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
