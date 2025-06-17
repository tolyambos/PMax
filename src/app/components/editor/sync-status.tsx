"use client";

import { useState, useEffect } from "react";

interface SyncStatusProps {
  isSaving: boolean;
  lastSaved: Date | null;
}

export default function SyncStatus({ isSaving, lastSaved }: SyncStatusProps) {
  const [showStatus, setShowStatus] = useState(false);

  // Show sync status for 3 seconds after saving changes
  useEffect(() => {
    if (isSaving) {
      setShowStatus(true);
    } else if (lastSaved) {
      // Keep showing the status for a while after saving
      setShowStatus(true);
      const timer = setTimeout(() => {
        setShowStatus(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isSaving, lastSaved]);

  if (!showStatus) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 p-3 rounded-md border shadow-md bg-background">
      <div className="flex gap-2 items-center">
        {isSaving ? (
          <>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm">Syncing with database...</span>
          </>
        ) : lastSaved ? (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm">
              Synced at {lastSaved.toLocaleTimeString()}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
