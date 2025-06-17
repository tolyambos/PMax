"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { Settings } from "lucide-react";
import ExportModal from "./export-modal";
import EditorDBStatus from "./db-status";
import SettingsModal from "@/app/components/settings/SettingsModal";

interface EditorNavigationProps {
  projectName: string;
  projectId?: string;
  onLogout?: () => void;
  isLoading?: boolean;
  isSaving?: boolean;
  lastSaved?: Date | null;
  onSave?: () => Promise<void>;
}

export default function EditorNavigation({
  projectName,
  projectId = "demo-project",
  onLogout,
  isLoading = false,
  isSaving: propIsSaving = false,
  lastSaved = null,
  onSave,
}: EditorNavigationProps) {
  const [localIsSaving, setLocalIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const { toast } = useToast();

  // Use either prop value or local state
  const isSaving = propIsSaving || localIsSaving;

  const handleSave = async () => {
    if (onSave) {
      // Use the provided save function
      try {
        setLocalIsSaving(true);
        await onSave();
        toast({
          title: "Project saved",
          description: "All changes have been saved to the database.",
        });
      } catch (error) {
        toast({
          title: "Save failed",
          description: "Failed to save changes. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLocalIsSaving(false);
      }
    } else {
      // Fall back to mock save if no function provided
      setLocalIsSaving(true);

      setTimeout(() => {
        setLocalIsSaving(false);
        toast({
          title: "Project saved",
          description: "All changes have been saved successfully.",
        });
      }, 800);
    }
  };

  return (
    <div className="flex justify-between items-center px-4 h-16 border-b bg-background">
      <div className="flex gap-4 items-center">
        <Link href="/" className="text-xl font-bold">
          PMax
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <div className="text-sm font-medium">{projectName}</div>
      </div>

      <div className="flex gap-4 items-center">
        {projectId && <EditorDBStatus projectId={projectId} />}
        {lastSaved && (
          <div className="ml-2 text-xs text-muted-foreground">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            data-save-button="true"
          >
            {isSaving ? "Saving..." : isLoading ? "Loading..." : "Save"}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            disabled={isLoading}
          >
            Export Video
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSettingsModalOpen(true)}
            disabled={isLoading}
          >
            <Settings className="w-4 h-4" />
          </Button>

          {onLogout && (
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Logout
            </Button>
          )}
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectId={projectId}
      />

      <SettingsModal
        open={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
      />
    </div>
  );
}
