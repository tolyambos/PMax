"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import ProjectWizard from "@/app/components/project-creation/project-wizard";
import MainNavigation from "@/app/components/navigation/main-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function WizardPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [canCreateProjects, setCanCreateProjects] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // Check if user can create projects
    const checkPermissions = async () => {
      try {
        const response = await fetch("/api/projects/can-create");
        const data = await response.json();
        
        console.log("Permission check response:", data); // Debug log
        
        if (data.success) {
          setCanCreateProjects(data.canCreate);
          if (!data.canCreate) {
            setError(data.reason || "You don't have permission to create projects.");
          }
        } else {
          setError("Failed to check permissions.");
        }
      } catch (err) {
        console.error("Permission check error:", err); // Debug log
        setError("Failed to check permissions.");
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, [isLoaded, isSignedIn, router]);

  const handleWizardComplete = (projectData: any) => {
    // Navigate to editor with new project
    console.log("Wizard completed with project data:", projectData);
    if (projectData && projectData.projectId) {
      console.log("Redirecting to editor:", projectData.projectId);
      router.push(`/editor/${projectData.projectId}`);
    } else {
      console.error("Invalid project data or missing projectId:", projectData);
      // Fallback to projects page
      router.push("/projects");
    }
  };

  const handleWizardCancel = () => {
    // Navigate back to dashboard
    router.push("/dashboard");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (canCreateProjects === false || error) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {error || "You don't have permission to create projects."}
              </p>
              <p className="text-sm text-muted-foreground">
                Please contact an administrator to request project creation permissions.
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => router.push("/dashboard")}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ProjectWizard
        onComplete={handleWizardComplete}
        onCancel={handleWizardCancel}
      />
    </div>
  );
}
