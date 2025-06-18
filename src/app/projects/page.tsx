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
} from "lucide-react";
import { motion } from "framer-motion";
import { api as trpc } from "@/app/utils/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import MainNavigation from "@/app/components/navigation/main-nav";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [canCreateProjects, setCanCreateProjects] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch projects using tRPC
  const { data: projects, isLoading: projectsLoading, refetch } = trpc.project.getAll.useQuery();

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
              <Button asChild>
                <Link href="/wizard">
                  <Plus className="mr-2 w-4 h-4" />
                  Create New Project
                </Link>
              </Button>
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

      {/* Content */}
      <div className="container px-4 py-8 mx-auto">
        {projects && projects.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="group hover:shadow-lg transition-all cursor-pointer overflow-hidden">
                  <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-accent/10">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Video className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}

                    {/* Overlay with play button on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/editor/${project.id}`)}
                      >
                        <Play className="mr-2 w-4 h-4" />
                        Edit Project
                      </Button>
                    </div>

                    {/* Format badge */}
                    <Badge
                      className="absolute top-2 left-2"
                      variant="secondary"
                    >
                      {project.format}
                    </Badge>

                    {/* Duration badge */}
                    <Badge className="absolute top-2 right-2" variant="outline">
                      {formatDuration(project.duration)}
                    </Badge>
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

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/editor/${project.id}`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                        {project.scenes?.length || 0} scenes
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
              <Video className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              {canCreateProjects ? (
                <>
                  <p className="text-muted-foreground text-center mb-6">
                    Create your first AI-powered video project to get started
                  </p>
                  <Button asChild>
                    <Link href="/wizard">
                      <Plus className="mr-2 w-4 h-4" />
                      Create First Project
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
      </div>
    </div>
  );
}
