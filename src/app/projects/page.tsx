"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Plus,
  Video,
  Calendar,
  Clock,
  MoreVertical,
  Play,
  Edit,
  Trash2,
  Copy,
  Ban,
  AlertCircle,
  Search,
  Filter,
  Heart,
  HeartOff,
  CheckSquare,
  Square,
  Download,
  X,
  Star,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { api as trpc } from "@/app/utils/trpc";
import { S3Image } from "@/app/components/bulk-video/s3-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Input } from "@/app/components/ui/input";
import { useToast } from "@/app/components/ui/use-toast";
import { cn } from "@/lib/utils";
import MainNavigation from "@/app/components/navigation/main-nav";
import BulkExportProgressModal from "@/app/components/ui/bulk-export-progress-modal";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [canCreateProjects, setCanCreateProjects] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLiked, setFilterLiked] = useState<'all' | 'liked' | 'disliked'>('all');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [projectsWithLikes, setProjectsWithLikes] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  // Fetch projects using tRPC
  const { data: projects, isLoading: projectsLoading, refetch } = trpc.project.getAll.useQuery();

  // tRPC mutations
  const deleteProjectMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast({
        title: "Project Deleted",
        description: "The project has been permanently removed.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete project",
        description: error.message,
      });
    },
  });


  // Initialize projects with like status and separate by type
  useEffect(() => {
    if (projects) {
      setProjectsWithLikes(projects.map(p => ({ 
        ...p, 
        isStarred: false,
        isBulk: p.isBulk || (p.bulkVideos && p.bulkVideos.length > 0)
      })));
    }
  }, [projects]);

  // Bulk operation handlers
  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProjectMutation.mutateAsync({ id: projectId });
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedProjects).map(id => 
          deleteProjectMutation.mutateAsync({ id })
        )
      );
      setSelectedProjects(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error('Error bulk deleting projects:', error);
    }
  };

  const handleBulkExportClick = () => {
    if (selectedProjects.size === 0) return;
    setShowExportModal(true);
  };

  const handleBulkExport = async () => {
    setIsExporting(true);
    
    try {
      // Call the bulk export API
      const response = await fetch('/api/video/bulk-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectIds: Array.from(selectedProjects),
          quality: 'high', // You can make this configurable later
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `bulk-export-${Date.now()}.zip`;

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success and clear selection
      const exportedCount = selectedProjects.size;
      setSelectedProjects(new Set());
      setBulkMode(false);
      setShowExportModal(false);
      
      toast({
        title: "Bulk Export Complete",
        description: `Successfully exported ${exportedCount} projects as ${filename}`,
      });

    } catch (error) {
      console.error('Error bulk exporting projects:', error);
      toast({
        variant: "destructive",
        title: "Bulk Export Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      throw error; // Re-throw to let the modal handle it
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkLike = () => {
    if (selectedProjects.size === 0) return;
    
    setProjectsWithLikes(prev => 
      prev.map(p => 
        selectedProjects.has(p.id) ? { ...p, isStarred: true } : p
      )
    );
    setSelectedProjects(new Set());
  };

  const handleBulkDislike = () => {
    if (selectedProjects.size === 0) return;
    
    setProjectsWithLikes(prev => 
      prev.map(p => 
        selectedProjects.has(p.id) ? { ...p, isStarred: false } : p
      )
    );
    setSelectedProjects(new Set());
  };

  const handleToggleLike = (projectId: string) => {
    setProjectsWithLikes(prev => 
      prev.map(p => 
        p.id === projectId ? { ...p, isStarred: !p.isStarred } : p
      )
    );
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  };

  // Filtering logic
  const filteredProjects = projectsWithLikes
    .filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLiked = 
        filterLiked === "all" || 
        (filterLiked === "liked" && project.isStarred) ||
        (filterLiked === "disliked" && !project.isStarred);
      const matchesType = activeTab === "single" ? !project.isBulk : project.isBulk;
      return matchesSearch && matchesLiked && matchesType;
    });

  // Check user permissions and banned status
  useEffect(() => {
    if (isLoaded && user) {
      setIsLoading(true);
      // Sync user data with database
      fetch("/api/user/sync", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          console.log("User synced:", data);
          
          // Check if user is banned
          if (data.user && data.user.permissions) {
            const perms = data.user.permissions;
            const banned = !perms.canCreateProjects && 
                          !perms.canUploadAssets && 
                          (perms.maxProjects === 0 || perms.maxProjects === "0");
            setIsBanned(banned);
            setCanCreateProjects(perms.canCreateProjects || false);
          }
          setIsCheckingPermissions(false);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to sync user:", err);
          setIsCheckingPermissions(false);
          setIsLoading(false);
        });
    }
  }, [isLoaded, user]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  };

  if (!isLoaded || isLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Banned user view
  if (isBanned) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="container px-4 mx-auto py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
                <Ban className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
              <p className="text-muted-foreground mb-6">
                Your account has been restricted. You cannot access projects at this time.
              </p>
              
              <div className="space-y-4 text-left max-w-md mx-auto">
                <div className="bg-background/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    What this means:
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• You cannot view existing projects</li>
                    <li>• You cannot create new projects</li>
                    <li>• You cannot upload new assets</li>
                    <li>• Your account has limited access</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col gap-3 max-w-xs mx-auto">
                <Button
                  variant="outline"
                  onClick={() => router.push("/")}
                  className="w-full"
                >
                  Return to Home
                </Button>
                <p className="text-xs text-muted-foreground">
                  If you believe this is a mistake, please contact support.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <MainNavigation />

      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container px-4 py-6 mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Your Projects</h1>
              <p className="text-muted-foreground mt-1">
                Manage and edit your video creations
              </p>
            </div>
            {canCreateProjects ? (
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/wizard">
                    <Video className="mr-2 w-4 h-4" />
                    New Single Project
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/bulk-video/create">
                    <FileSpreadsheet className="mr-2 w-4 h-4" />
                    New Bulk Project
                  </Link>
                </Button>
              </div>
            ) : (
              <Button disabled variant="outline">
                <Plus className="mr-2 w-4 h-4" />
                Create New Project
                <span className="ml-2 text-xs">(Restricted)</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container px-4 py-4 mx-auto">
          <div className="flex flex-col gap-4 sm:flex-row">
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
                    <Heart className="mr-2 w-4 h-4" />
                    Liked
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilterLiked("all")}>
                    All Projects
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterLiked("liked")}>
                    Liked Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterLiked("disliked")}>
                    Disliked Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={bulkMode ? "default" : "outline"}
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedProjects(new Set());
                }}
              >
                {bulkMode ? (
                  <X className="mr-2 w-4 h-4" />
                ) : (
                  <CheckSquare className="mr-2 w-4 h-4" />
                )}
                {bulkMode ? "Cancel" : "Select"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {bulkMode && (
        <div className="border-b bg-muted/20">
          <div className="container px-4 py-4 mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedProjects.size === filteredProjects.length ? (
                    <CheckSquare className="mr-2 w-4 h-4" />
                  ) : (
                    <Square className="mr-2 w-4 h-4" />
                  )}
                  {selectedProjects.size === filteredProjects.length ? "Deselect All" : "Select All"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedProjects.size} of {filteredProjects.length} selected
                </span>
              </div>
              
              {selectedProjects.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkLike}
                  >
                    <Heart className="mr-2 w-4 h-4" />
                    Like Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDislike}
                  >
                    <HeartOff className="mr-2 w-4 h-4" />
                    Dislike Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExportClick}
                    disabled={isExporting}
                  >
                    <Download className="mr-2 w-4 h-4" />
                    Export Selected
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={deleteProjectMutation.isLoading}
                  >
                    <Trash2 className="mr-2 w-4 h-4" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container px-4 py-8 mx-auto">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "single" | "bulk")}>
          <TabsList className="mb-6">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Single Projects
              <Badge variant="outline" className="ml-1">
                {projectsWithLikes.filter(p => !p.isBulk).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Bulk Projects
              <Badge variant="outline" className="ml-1">
                {projectsWithLikes.filter(p => p.isBulk).length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
        {projectsWithLikes && projectsWithLikes.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={cn(
                    "group hover:shadow-lg transition-all cursor-pointer overflow-hidden",
                    bulkMode && selectedProjects.has(project.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    if (bulkMode) {
                      toggleProjectSelection(project.id);
                    } else {
                      if (project.isBulk) {
                        router.push(`/bulk-video/${project.id}`);
                      } else {
                        router.push(`/editor/${project.id}`);
                      }
                    }
                  }}
                >
                  <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-accent/10">
                    {/* Checkbox for bulk mode */}
                    {bulkMode && (
                      <div 
                        className="absolute top-2 left-2 z-10 bg-background/80 rounded p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProjectSelection(project.id);
                        }}
                      >
                        {selectedProjects.has(project.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    )}

                    {/* Star/Like button */}
                    <button
                      className="absolute top-2 right-2 z-10 bg-background/80 rounded p-1 hover:bg-background/90 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(project.id);
                      }}
                    >
                      {project.isStarred ? (
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      ) : (
                        <Star className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {project.thumbnail ? (
                      <S3Image
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                        fill
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {project.isBulk ? (
                          <FileSpreadsheet className="w-12 h-12 text-muted-foreground/50" />
                        ) : (
                          <Video className="w-12 h-12 text-muted-foreground/50" />
                        )}
                      </div>
                    )}

                    {!bulkMode && (
                      <>
                        {/* Overlay with play button on hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (project.isBulk) {
                                router.push(`/bulk-video/${project.id}`);
                              } else {
                                router.push(`/editor/${project.id}`);
                              }
                            }}
                          >
                            {project.isBulk ? (
                              <>
                                <Layers className="mr-2 w-4 h-4" />
                                Manage Bulk Videos
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 w-4 h-4" />
                                Edit Project
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Format/Type badge */}
                        <Badge
                          className="absolute bottom-2 left-2"
                          variant="secondary"
                        >
                          {project.isBulk ? `${project.bulkVideos?.length || 0} videos` : project.format}
                        </Badge>

                        {/* Duration badge */}
                        <Badge className="absolute bottom-2 right-2" variant="outline">
                          {formatDuration(project.duration)}
                        </Badge>
                      </>
                    )}
                  </div>

                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="line-clamp-1">
                          {project.name}
                        </CardTitle>
                        {project.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {project.description}
                          </CardDescription>
                        )}
                      </div>

                      {!bulkMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                if (project.isBulk) {
                                  router.push(`/bulk-video/${project.id}`);
                                } else {
                                  router.push(`/editor/${project.id}`);
                                }
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {project.isBulk ? "Manage" : "Edit"}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(new Date(project.updatedAt))}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {project.isBulk ? `${project.bulkVideos?.length || 0} videos` : `${project.scenes?.length || 0} scenes`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="max-w-md mx-auto mt-12">
            <CardContent className="flex flex-col items-center justify-center py-12">
              {activeTab === "single" ? (
                <Video className="w-16 h-16 text-muted-foreground/50 mb-4" />
              ) : (
                <FileSpreadsheet className="w-16 h-16 text-muted-foreground/50 mb-4" />
              )}
              <h3 className="text-lg font-semibold mb-2">
                No {activeTab === "single" ? "single" : "bulk"} projects yet
              </h3>
              {canCreateProjects ? (
                <>
                  <p className="text-muted-foreground text-center mb-6">
                    {activeTab === "single" 
                      ? "Create your first AI-powered video project to get started"
                      : "Create your first bulk video project to generate multiple videos at once"
                    }
                  </p>
                  <Button asChild>
                    <Link href={activeTab === "single" ? "/wizard" : "/bulk-video/create"}>
                      <Plus className="mr-2 w-4 h-4" />
                      Create First {activeTab === "single" ? "Project" : "Bulk Project"}
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-center mb-6">
                  You don't have any projects yet. Your account is currently restricted from creating new projects.
                </p>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk Export Progress Modal */}
      <BulkExportProgressModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedProjects={selectedProjects}
        projectsData={filteredProjects.map(p => ({ id: p.id, name: p.name }))}
        onStartExport={handleBulkExport}
      />
    </div>
  );
}
