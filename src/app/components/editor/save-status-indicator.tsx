"use client";

import { useState, useEffect } from "react";
import { Check, Save, RotateCw, AlertCircle } from "lucide-react";
import { cn } from "@/app/utils/cn";

interface SaveStatusIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  className?: string;
}

export default function SaveStatusIndicator({
  isSaving,
  lastSaved,
  hasUnsavedChanges,
  className,
}: SaveStatusIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success indicator briefly after saving
  useEffect(() => {
    if (!isSaving && lastSaved) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isSaving, lastSaved]);

  const getIcon = () => {
    if (isSaving) {
      return <RotateCw className="w-4 h-4 animate-spin" />;
    }

    if (showSuccess) {
      return <Check className="w-4 h-4" />;
    }

    if (hasUnsavedChanges) {
      return <Save className="w-4 h-4" />;
    }

    return <Check className="w-4 h-4" />;
  };

  const getColor = () => {
    if (isSaving) {
      return "text-primary";
    }

    if (showSuccess) {
      return "text-accent";
    }

    if (hasUnsavedChanges) {
      return "text-amber-500";
    }

    return "text-accent";
  };

  const getTooltipText = () => {
    if (isSaving) {
      return "Saving changes...";
    }

    if (showSuccess) {
      return "Changes saved successfully";
    }

    if (hasUnsavedChanges) {
      return "You have unsaved changes";
    }

    if (lastSaved) {
      return `Last saved at ${lastSaved.toLocaleTimeString()}`;
    }

    return "All changes saved";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 transition-all duration-300",
        "bg-gradient-to-r from-primary/5 via-background/90 to-accent/5 backdrop-blur-md shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:from-primary/10 hover:to-accent/10",
        getColor(),
        className
      )}
      title={getTooltipText()}
    >
      {getIcon()}
      <span className="text-xs font-medium">
        {isSaving
          ? "Saving"
          : showSuccess
            ? "Saved"
            : hasUnsavedChanges
              ? "Unsaved"
              : "Synced"}
      </span>
    </div>
  );
}
