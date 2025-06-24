"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Progress } from "@/app/components/ui/progress";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Video,
  Package,
  Loader2,
} from "lucide-react";

interface BulkExportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProjects: Set<string>;
  projectsData: Array<{ id: string; name: string }>;
  onStartExport: () => Promise<void>;
}

interface ProjectStatus {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
}

export default function BulkExportProgressModal({
  isOpen,
  onClose,
  selectedProjects,
  projectsData,
  onStartExport,
}: BulkExportProgressModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStarted, setExportStarted] = useState(false);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [currentPhase, setCurrentPhase] = useState<"preparing" | "processing" | "packaging" | "complete">("preparing");
  const [overallProgress, setOverallProgress] = useState(0);

  // Initialize project statuses when modal opens
  useEffect(() => {
    if (isOpen && !exportStarted) {
      const statuses = Array.from(selectedProjects).map(projectId => {
        const project = projectsData.find(p => p.id === projectId);
        return {
          id: projectId,
          name: project?.name || `Project ${projectId}`,
          status: "pending" as const,
        };
      });
      setProjectStatuses(statuses);
      setCurrentPhase("preparing");
      setOverallProgress(0);
    }
  }, [isOpen, selectedProjects, projectsData, exportStarted]);

  // Real-time progress updates using polling
  useEffect(() => {
    if (!isExporting) return;

    let exportId: string;
    let pollInterval: NodeJS.Timeout;

    const startExportAndPoll = async () => {
      try {
        // Start the export
        const response = await fetch('/api/video/bulk-export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectIds: Array.from(selectedProjects),
            quality: 'high',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start export');
        }

        const data = await response.json();
        exportId = data.exportId;

        console.log('Export started with ID:', exportId);

        // Start polling for progress
        pollInterval = setInterval(async () => {
          try {
            const progressResponse = await fetch(`/api/video/bulk-export-status?exportId=${exportId}`);
            if (!progressResponse.ok) return;

            const progressData = await progressResponse.json();
            console.log('Progress update:', progressData);

            // Update overall progress
            setOverallProgress(progressData.progress || 0);

            // Update phase
            switch (progressData.status) {
              case 'preparing':
                setCurrentPhase('preparing');
                break;
              case 'processing':
                setCurrentPhase('processing');
                break;
              case 'packaging':
                setCurrentPhase('packaging');
                break;
              case 'complete':
                setCurrentPhase('complete');
                break;
              case 'error':
                setCurrentPhase('complete');
                break;
            }

            // Update project statuses
            if (progressData.projects) {
              setProjectStatuses(progressData.projects);
            }

            // Handle completion
            if (progressData.status === 'complete') {
              clearInterval(pollInterval);
              setIsExporting(false); // Allow modal to be closed
              
              // Handle download
              if (progressData.downloadUrl) {
                window.location.href = progressData.downloadUrl;
              }
            }

            // Handle error
            if (progressData.status === 'error') {
              clearInterval(pollInterval);
              setIsExporting(false); // Allow modal to be closed
              console.error('Export failed:', progressData.error);
            }

          } catch (pollError) {
            console.error('Error polling progress:', pollError);
          }
        }, 1000); // Poll every second

      } catch (error) {
        console.error('Error starting export:', error);
        setIsExporting(false);
      }
    };

    startExportAndPoll();

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isExporting, selectedProjects]);

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportStarted(true);
    
    // Note: The real progress tracking is now handled in the useEffect above
    // This function just initiates the export process
  };

  const handleClose = () => {
    if (!isExporting) {
      setExportStarted(false);
      setIsExporting(false);
      setProjectStatuses([]);
      setCurrentPhase("preparing");
      setOverallProgress(0);
      onClose();
    }
  };

  const getPhaseInfo = () => {
    switch (currentPhase) {
      case "preparing":
        return {
          title: "Preparing Export",
          description: "Getting ready to process your projects...",
          icon: Clock,
        };
      case "processing":
        return {
          title: "Rendering Videos",
          description: "Processing and rendering your project videos...",
          icon: Video,
        };
      case "packaging":
        return {
          title: "Creating Archive",
          description: "Packaging videos into downloadable archive...",
          icon: Package,
        };
      case "complete":
        return {
          title: "Export Complete",
          description: "Your projects have been exported successfully!",
          icon: CheckCircle,
        };
    }
  };

  const phaseInfo = getPhaseInfo();
  const completedCount = projectStatuses.filter(p => p.status === "completed").length;
  const errorCount = projectStatuses.filter(p => p.status === "error").length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <phaseInfo.icon className="w-5 h-5" />
            {phaseInfo.title}
          </DialogTitle>
          <DialogDescription>
            {phaseInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            
            {exportStarted && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{selectedProjects.size} total projects</span>
                {completedCount > 0 && <span>{completedCount} completed</span>}
                {errorCount > 0 && <span className="text-destructive">{errorCount} failed</span>}
              </div>
            )}
          </div>

          {/* Project List */}
          {exportStarted && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium">Project Status</h4>
              <div className="space-y-2">
                <AnimatePresence>
                  {projectStatuses.map((project) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {project.status === "pending" && (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                          {project.status === "processing" && (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          )}
                          {project.status === "completed" && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {project.status === "error" && (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          {project.error && (
                            <p className="text-xs text-destructive">{project.error}</p>
                          )}
                        </div>
                      </div>
                      
                      <Badge 
                        variant={
                          project.status === "completed" 
                            ? "default" 
                            : project.status === "error"
                            ? "destructive"
                            : project.status === "processing"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {project.status === "pending" && "Pending"}
                        {project.status === "processing" && "Rendering"}
                        {project.status === "completed" && "Complete"}
                        {project.status === "error" && "Failed"}
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            {!exportStarted ? (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleStartExport} className="gap-2">
                  <Download className="w-4 h-4" />
                  Start Export
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                onClick={handleClose}
                disabled={isExporting}
              >
                {currentPhase === "complete" ? "Close" : "Cancel"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}