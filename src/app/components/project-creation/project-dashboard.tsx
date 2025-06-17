"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useToast } from "@/app/components/ui/use-toast";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Edit,
  Download,
  Share,
  Trash2,
  Sparkles,
  Clock,
  Eye,
  Star,
  Grid3X3,
  List,
  Calendar,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ProjectWizard from "./project-wizard";
import Image from "next/image";
import { api as trpc } from "@/app/utils/trpc";

// Helper function to refresh S3 URLs
const refreshS3Url = async (url: string): Promise<string> => {
  if (
    !url ||
    (!url.includes("wasabisys.com") &&
      !url.includes("amazonaws.com") &&
      !url.includes("s3."))
  ) {
    console.log("[refreshS3Url] Not an S3 URL, returning as-is:", url);
    return url;
  }

  console.log("[refreshS3Url] Refreshing S3 URL:", url);

  try {
    const response = await fetch("/api/s3/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      const result = await response.json();
      const refreshedUrl = result.presignedUrl || url;
      console.log("[refreshS3Url] Refreshed URL:", refreshedUrl);
      return refreshedUrl;
    } else {
      console.error(
        "[refreshS3Url] API response not OK:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("[refreshS3Url] Error refreshing S3 URL:", error);
  }

  console.log("[refreshS3Url] Falling back to original URL");
  return url;
};

// Check if URL is S3
const isS3Url = (url: string): boolean => {
  return (
    !!url &&
    (url.includes("wasabisys.com") ||
      url.includes("amazonaws.com") ||
      url.includes("s3."))
  );
};

// Component to handle S3 image with refresh
const S3Image = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      console.log(`[S3Image] Loading image for ${alt} with src:`, src);

      if (!src) {
        console.error(`[S3Image] No src provided for ${alt}`);
        setHasError(true);
        setIsLoading(false);
        return;
      }

      // Skip non-S3 URLs (old project logic)
      if (!isS3Url(src)) {
        console.log(`[S3Image] Skipping non-S3 URL for ${alt}:`, src);
        setHasError(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const refreshedUrl = await refreshS3Url(src);
        console.log(
          `[S3Image] Setting refreshed URL for ${alt}:`,
          refreshedUrl
        );
        setImageUrl(refreshedUrl);
      } catch (error) {
        console.error(`[S3Image] Error refreshing S3 URL for ${alt}:`, error);
        setHasError(true);
      }

      setIsLoading(false);
    };

    loadImage();
  }, [src, alt]);

  if (isLoading) {
    console.log(`[S3Image] Showing loading state for ${alt}`);
    return <div className={cn("animate-pulse bg-muted", className)} />;
  }

  if (hasError || !imageUrl) {
    console.log(`[S3Image] Showing fallback state for ${alt}`, {
      hasError,
      imageUrl,
      isS3: isS3Url(src),
    });
    return (
      <div
        className={cn(
          "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center",
          className
        )}
      >
        <span className="text-4xl">🎬</span>
      </div>
    );
  }

  console.log(`[S3Image] Rendering image for ${alt} with URL:`, imageUrl);
  return (
    <Image
      src={imageUrl}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      onError={(e) => {
        console.error(`[S3Image] Image load error for ${alt}:`, e);
        setHasError(true);
      }}
    />
  );
};

const STATUS_CONFIGS = {
  completed: { color: "bg-green-500", label: "Completed", icon: "✅" },
  generating: { color: "bg-blue-500", label: "Generating", icon: "⚡" },
  draft: { color: "bg-yellow-500", label: "Draft", icon: "📝" },
  failed: { color: "bg-red-500", label: "Failed", icon: "❌" },
};

interface ProjectDashboardProps {
  onProjectSelect: (projectId: string) => void;
}

export default function ProjectDashboard({
  onProjectSelect,
}: ProjectDashboardProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showWizard, setShowWizard] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Use tRPC to fetch projects
  const projectsQuery = trpc.project.getAll.useQuery(undefined, {
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: 1000,
    onError: (error) => {
      console.error("Error fetching projects:", error);
      toast({
        variant: "destructive",
        title: "Failed to load projects",
        description: "Please refresh the page to try again.",
      });
    },
  });

  // Load projects from API
  useEffect(() => {
    const loadProjects = async () => {
      setIsLoading(true);

      if (projectsQuery.data && Array.isArray(projectsQuery.data)) {
        console.log("Loading projects from tRPC:", projectsQuery.data.length);

        // Transform API data to match our format
        const transformedProjects = projectsQuery.data.map((project: any) => {
          console.log(
            `[ProjectDashboard] FULL project ${project.name}:`,
            project
          );
          console.log(`[ProjectDashboard] Project keys:`, Object.keys(project));

          // Get first scene background image
          let thumbnailUrl = null;

          if (project.scenes && project.scenes.length > 0) {
            const firstScene = project.scenes[0];
            console.log(
              `[ProjectDashboard] FULL first scene of ${project.name}:`,
              firstScene
            );
            console.log(
              `[ProjectDashboard] Scene keys:`,
              Object.keys(firstScene)
            );

            // Try multiple possible field names, but only use S3 URLs
            const potentialUrl =
              firstScene.imageUrl ||
              firstScene.image_url ||
              firstScene.backgroundImage ||
              firstScene.background_image ||
              firstScene.url ||
              null;

            // Only use S3 URLs, skip old localhost/upload URLs
            if (potentialUrl && isS3Url(potentialUrl)) {
              thumbnailUrl = potentialUrl;
            } else {
              thumbnailUrl = null;
              console.log(
                `[ProjectDashboard] Skipping non-S3 URL for ${project.name}:`,
                potentialUrl
              );
            }

            console.log(`[ProjectDashboard] Tried fields:`, {
              imageUrl: firstScene.imageUrl,
              image_url: firstScene.image_url,
              backgroundImage: firstScene.backgroundImage,
              background_image: firstScene.background_image,
              url: firstScene.url,
            });
          } else {
            console.log(
              `[ProjectDashboard] No scenes found for ${project.name}. Project scenes:`,
              project.scenes
            );
          }

          console.log(
            `[ProjectDashboard] Project ${project.name}: final thumbnail = ${thumbnailUrl}`
          );

          return {
            id: project.id,
            name: project.name || "Untitled Project",
            description: project.description || "",
            template: project.adType || "custom",
            format: project.format || "16:9",
            style: project.style || "cinematic",
            status: "completed", // All saved projects are completed
            duration: project.totalDuration || 15,
            scenes: project.scenes?.length || 0,
            thumbnail: thumbnailUrl,
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: project.updatedAt || new Date().toISOString(),
            views: 0, // Default views
            isStarred: false, // Default not starred
          };
        });

        setProjects(transformedProjects);
      } else {
        // Try direct API as fallback
        try {
          const response = await fetch("/api/dashboard/projects");
          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.projects)) {
              console.log(
                "Loading projects from REST API:",
                data.projects.length
              );

              const transformedProjects = data.projects.map((project: any) => {
                // Get first scene background image
                let thumbnailUrl = null;

                if (project.scenes && project.scenes.length > 0) {
                  const firstScene = project.scenes[0];
                  console.log(
                    `[ProjectDashboard] First scene of ${project.name}:`,
                    {
                      id: firstScene.id,
                      imageUrl: firstScene.imageUrl,
                      image_url: firstScene.image_url,
                      videoUrl: firstScene.videoUrl,
                      useAnimatedVersion: firstScene.useAnimatedVersion,
                    }
                  );

                  // Try multiple possible field names, but only use S3 URLs
                  const potentialUrl =
                    firstScene.imageUrl ||
                    firstScene.image_url ||
                    firstScene.backgroundImage ||
                    firstScene.background_image ||
                    firstScene.url ||
                    null;

                  // Only use S3 URLs, skip old localhost/upload URLs
                  if (potentialUrl && isS3Url(potentialUrl)) {
                    thumbnailUrl = potentialUrl;
                  } else {
                    thumbnailUrl = null;
                    console.log(
                      `[ProjectDashboard] Skipping non-S3 URL for ${project.name}:`,
                      potentialUrl
                    );
                  }
                }

                console.log(
                  `[ProjectDashboard] Project ${project.name}: final thumbnail = ${thumbnailUrl}`
                );

                return {
                  id: project.id,
                  name: project.name || "Untitled Project",
                  description: project.description || "",
                  template: project.adType || "custom",
                  format: project.format || "16:9",
                  style: project.style || "cinematic",
                  status: "completed",
                  duration: project.totalDuration || 15,
                  scenes: project.scenes?.length || 0,
                  thumbnail: thumbnailUrl,
                  createdAt: project.createdAt || new Date().toISOString(),
                  updatedAt: project.updatedAt || new Date().toISOString(),
                  views: 0,
                  isStarred: false,
                };
              });
              setProjects(transformedProjects);
            }
          }
        } catch (error) {
          console.error("Error fetching projects directly:", error);
        }
      }

      setIsLoading(false);
    };

    loadProjects();
  }, [projectsQuery.data, toast]);

  const filteredProjects = projects
    .filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterStatus === "all" || project.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
        case "views":
          return b.views - a.views;
        default:
          return 0;
      }
    });

  const handleCreateProject = (apiResult: any) => {
    // Handle real API response from generate-project endpoint
    console.log("Dashboard received API result:", apiResult);
    if (apiResult && apiResult.projectId && apiResult.success) {
      console.log("Redirecting to project ID:", apiResult.projectId);
      const newProject = {
        id: apiResult.projectId,
        name: apiResult.name,
        description: apiResult.description || "",
        template: "custom", // Default since template info isn't in response
        format: apiResult.format,
        style: "cinematic", // Default since style info isn't in response
        status: "completed", // API returns generated project
        duration: 15, // Default duration
        scenes: apiResult.scenes?.length || 0,
        thumbnail:
          apiResult.scenes?.[0]?.imageUrl || "/api/placeholder/300/400",
        createdAt: apiResult.timestamp,
        updatedAt: apiResult.timestamp,
        views: 0,
        isStarred: false,
      };
      setProjects([newProject, ...projects]);
      setShowWizard(false);

      // Navigate to the editor with the real project ID
      setTimeout(() => {
        window.location.href = `/editor/${apiResult.projectId}`;
      }, 1000);

      toast({
        title: "Project Generated! 🎉",
        description: "Your AI video ad is ready to view and edit.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Invalid response from server. Please try again.",
      });
    }
  };

  const handleStarProject = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, isStarred: !p.isStarred } : p
      )
    );
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    toast({
      title: "Project Deleted",
      description: "The project has been permanently removed.",
    });
  };

  const ProjectCard = ({ project }: { project: any }) => {
    const statusConfig =
      STATUS_CONFIGS[project.status as keyof typeof STATUS_CONFIGS];

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
          <CardHeader className="p-0">
            <div
              className="overflow-hidden relative h-48 rounded-t-lg bg-muted"
              onClick={() => onProjectSelect(project.id)}
            >
              {/* Project thumbnail with S3 refresh */}
              {project.thumbnail ? (
                <S3Image
                  src={project.thumbnail}
                  alt={project.name}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                  {project.template === "product" && "📦"}
                  {project.template === "brand" && "🏢"}
                  {project.template === "promo" && "🎯"}
                  {!["product", "brand", "promo"].includes(project.template) &&
                    "🎨"}
                </div>
              )}

              {/* Status overlay */}
              <div className="absolute top-3 left-3">
                <Badge
                  className={cn("text-white", statusConfig.color)}
                  variant="secondary"
                >
                  {statusConfig.icon} {statusConfig.label}
                </Badge>
              </div>

              {/* Star button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-12 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 bg-white/20 hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStarProject(project.id);
                }}
              >
                <Star
                  className={cn(
                    "w-4 h-4",
                    project.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-white"
                  )}
                />
              </Button>

              {/* More actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 bg-white/20 hover:bg-white/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4 text-white" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onProjectSelect(project.id)}>
                    <Edit className="mr-2 w-4 h-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="mr-2 w-4 h-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share className="mr-2 w-4 h-4" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => handleDeleteProject(project.id)}
                  >
                    <Trash2 className="mr-2 w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Play overlay */}
              {project.status === "completed" && (
                <div className="flex absolute inset-0 justify-center items-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/20">
                  <Button size="lg" className="rounded-full">
                    <Play className="ml-1 w-6 h-6" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-lg font-semibold line-clamp-1">
                {project.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <div className="flex gap-4 items-center">
                <span className="flex gap-1 items-center">
                  <Video className="w-3 h-3" />
                  {project.format}
                </span>
                <span className="flex gap-1 items-center">
                  <Clock className="w-3 h-3" />
                  {project.duration}s
                </span>
                <span className="flex gap-1 items-center">
                  <Eye className="w-3 h-3" />
                  {project.views}
                </span>
              </div>
              <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const ProjectListItem = ({ project }: { project: any }) => {
    const statusConfig =
      STATUS_CONFIGS[project.status as keyof typeof STATUS_CONFIGS];

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <Card className="transition-all duration-200 cursor-pointer group hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div
                className="relative w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0"
                onClick={() => onProjectSelect(project.id)}
              >
                {project.thumbnail ? (
                  <S3Image
                    src={project.thumbnail}
                    alt={project.name}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                    {project.template === "product" && "📦"}
                    {project.template === "brand" && "🏢"}
                    {project.template === "promo" && "🎯"}
                    {!["product", "brand", "promo"].includes(
                      project.template
                    ) && "🎨"}
                  </div>
                )}
              </div>

              <div
                className="flex-1 min-w-0"
                onClick={() => onProjectSelect(project.id)}
              >
                <div className="flex gap-2 items-center mb-1">
                  <h3 className="font-semibold truncate">{project.name}</h3>
                  <Badge
                    className={cn("text-white text-xs", statusConfig.color)}
                    variant="secondary"
                  >
                    {statusConfig.icon} {statusConfig.label}
                  </Badge>
                  {project.isStarred && (
                    <Star className="flex-shrink-0 w-4 h-4 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <p className="text-sm truncate text-muted-foreground">
                  {project.description}
                </p>
                <div className="flex gap-4 items-center mt-2 text-xs text-muted-foreground">
                  <span>{project.format}</span>
                  <span>{project.duration}s</span>
                  <span>{project.views} views</span>
                  <span>
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 items-center opacity-0 transition-opacity group-hover:opacity-100">
                {project.status === "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onProjectSelect(project.id)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onProjectSelect(project.id)}
                    >
                      <Edit className="mr-2 w-4 h-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="mr-2 w-4 h-4" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share className="mr-2 w-4 h-4" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 className="mr-2 w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (showWizard) {
    return (
      <ProjectWizard
        onComplete={handleCreateProject}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8 mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 justify-between mb-8 lg:flex-row lg:items-center">
          <div>
            <h1 className="mb-2 text-3xl font-bold">My Projects</h1>
            <p className="text-muted-foreground">
              Create and manage your AI-powered video advertisements
            </p>
          </div>

          <Button
            onClick={() => setShowWizard(true)}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:bg-gradient-to-r dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700 dark:text-white"
          >
            <Plus className="mr-2 w-5 h-5 dark:text-white" />
            Create New Project
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 w-4 h-4 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 w-4 h-4" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                  All Projects
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("completed")}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("generating")}>
                  Generating
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("draft")}>
                  Drafts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Calendar className="mr-2 w-4 h-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSortBy("recent")}>
                  Most Recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("name")}>
                  Name A-Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("views")}>
                  Most Views
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            >
              {viewMode === "grid" ? (
                <List className="w-4 h-4" />
              ) : (
                <Grid3X3 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Projects Grid/List */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="animate-spin w-16 h-16 mx-auto text-primary mb-4">
                <Sparkles className="w-full h-full" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Loading projects...
              </h3>
              <p className="text-muted-foreground">
                Fetching your video projects
              </p>
            </motion.div>
          ) : filteredProjects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <Sparkles className="mx-auto mb-4 w-16 h-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold">
                {searchQuery || filterStatus !== "all"
                  ? "No projects found"
                  : "No projects yet"}
              </h3>
              <p className="mb-6 text-muted-foreground">
                {searchQuery || filterStatus !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first AI-powered video ad to get started"}
              </p>
              {!searchQuery && filterStatus === "all" && (
                <Button onClick={() => setShowWizard(true)} size="lg">
                  <Plus className="mr-2 w-5 h-5" />
                  Create Your First Project
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProjects.map((project) => (
                    <ProjectListItem key={project.id} project={project} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
