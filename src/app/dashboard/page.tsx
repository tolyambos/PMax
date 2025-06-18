"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import Link from "next/link";
import ProjectLauncher from "@/app/components/project-creation/project-launcher";
import MainNavigation from "@/app/components/navigation/main-nav";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Video,
  Image,
  Zap,
  Crown,
  TrendingUp,
  Sparkles,
  Ban,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EnhancedProjectLauncherProps {
  onProjectSelect: (projectId: string) => void;
  onWizardStateChange?: (active: boolean) => void;
}

// Wrapper component to handle wizard state
function EnhancedProjectLauncher({
  onProjectSelect,
  onWizardStateChange,
}: EnhancedProjectLauncherProps) {
  useEffect(() => {
    // Monitor DOM changes to detect wizard state
    const observer = new MutationObserver(() => {
      // Check if wizard is active by looking for specific wizard elements
      const wizardElements = document.querySelectorAll(
        "[data-wizard-step], .project-wizard, .template-selector"
      );
      const isActive = wizardElements.length > 0;
      onWizardStateChange?.(isActive);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [onWizardStateChange]);

  return <ProjectLauncher onProjectSelect={onProjectSelect} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { isAdmin } = useIsAdmin();
  const [userStats, setUserStats] = useState({
    projectCount: 0,
    assetCount: 0,
    storageUsed: 0,
    maxProjects: 10,
    maxStorage: 1073741824,
  });
  const [isWizardActive, setIsWizardActive] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleProjectSelect = (projectId: string) => {
    // Navigate to the editor with the selected project
    router.push(`/editor/${projectId}`);
  };

  const handleWizardStateChange = (active: boolean) => {
    setIsWizardActive(active);
  };

  // Auto-sync user on first load and check banned status
  useEffect(() => {
    if (isLoaded && user) {
      setIsLoading(true);
      // Sync user data with database
      fetch("/api/user/sync", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          console.log("User synced:", data);
          if (data.stats) {
            setUserStats(data.stats);
          }
          
          // Check if user is banned
          if (data.user && data.user.permissions) {
            const perms = data.user.permissions;
            const banned = !perms.canCreateProjects && 
                          !perms.canUploadAssets && 
                          (perms.maxProjects === 0 || perms.maxProjects === "0");
            setIsBanned(banned);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to sync user:", err);
          setIsLoading(false);
        });
    }
  }, [user, isLoaded]);

  const storagePercentage =
    (userStats.storageUsed / userStats.maxStorage) * 100;
  const projectPercentage =
    (userStats.projectCount / userStats.maxProjects) * 100;

  if (!isLoaded || isLoading) {
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
              <h1 className="text-2xl font-bold mb-4">Account Restricted</h1>
              <p className="text-muted-foreground mb-6">
                Your account has been temporarily restricted. You currently cannot create new projects or upload assets.
              </p>
              
              <div className="space-y-4 text-left max-w-md mx-auto">
                <div className="bg-background/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    What this means:
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• You cannot create new projects</li>
                    <li>• You cannot upload new assets</li>
                    <li>• You can still view your existing projects</li>
                    <li>• You can still export completed projects</li>
                  </ul>
                </div>
                
                <div className="bg-background/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Your Account Status:</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Projects Created:</span>
                      <span>{userStats.projectCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assets Uploaded:</span>
                      <span>{userStats.assetCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage Used:</span>
                      <span>{(userStats.storageUsed / 1048576).toFixed(1)} MB</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col gap-3 max-w-xs mx-auto">
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
    <div className="min-h-screen bg-background">
      <MainNavigation />
      
      {/* Dashboard Stats Section */}
      <div className="container px-4 mx-auto py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {user?.firstName?.[0] ||
                      user?.emailAddresses[0]?.emailAddress?.[0] ||
                      "U"}
                  </span>
                </div>
                {isAdmin && (
                  <Crown className="absolute -top-1 -right-1 w-5 h-5 text-yellow-500" />
                )}
              </div>
            </motion.div>

            <div>
              <h1 className="text-2xl font-bold">
                Welcome back, {user?.firstName || "Creator"}!
              </h1>
              <p className="text-muted-foreground">
                Create amazing AI-powered videos
              </p>
            </div>
          </div>

          {/* User Stats */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Projects
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {userStats.projectCount}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      of {userStats.maxProjects}
                    </span>
                  </div>
                  <Progress
                    value={projectPercentage}
                    className="mt-2 h-1"
                  />
                </div>
                <Video className="w-6 h-6 text-primary" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-muted/50 border rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Assets
                  </p>
                  <span className="text-2xl font-bold">
                    {userStats.assetCount}
                  </span>
                </div>
                <Image className="w-6 h-6 text-muted-foreground" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-muted/50 border rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Storage
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {(userStats.storageUsed / 1048576).toFixed(0)} MB
                    </span>
                    <span className="text-sm text-muted-foreground">
                      of {(userStats.maxStorage / 1073741824).toFixed(0)} GB
                    </span>
                  </div>
                  <Progress
                    value={storagePercentage}
                    className="mt-2 h-1"
                  />
                </div>
                <TrendingUp className="w-6 h-6 text-muted-foreground" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Plan
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">
                      {isAdmin ? "Admin" : "Free"}
                    </span>
                    {isAdmin && (
                      <Sparkles className="w-4 h-4 text-accent" />
                    )}
                  </div>
                </div>
                <Zap className="w-6 h-6 text-accent" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Project Creation Content */}
      <EnhancedProjectLauncher
        onProjectSelect={handleProjectSelect}
        onWizardStateChange={handleWizardStateChange}
      />
    </div>
  );
}
