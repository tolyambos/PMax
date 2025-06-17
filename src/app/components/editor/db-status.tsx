"use client";

import { useEffect, useState } from "react";

export default function EditorDBStatus({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<"loading" | "connected" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Checking database...");

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // First check general database connection
        const response = await fetch("/api/db-status");
        const data = await response.json();

        if (data.status !== "connected") {
          setStatus("error");
          setMessage(
            `Database disconnected: ${data.message || "Unknown error"}`
          );
          return;
        }

        // Then check if project exists
        const projectResponse = await fetch(
          `/api/db-check/project?id=${projectId}`
        );
        const projectData = await projectResponse.json();

        if (projectData.exists) {
          setStatus("connected");
          setMessage(`Project found in database (ID: ${projectData.id})`);
        } else {
          setStatus("error");
          setMessage(`Project not found in database (ID: ${projectId})`);
        }
      } catch (error) {
        console.error("Failed to check status:", error);
        setStatus("error");
        setMessage("Failed to check database status");
      }
    };

    if (projectId) {
      checkStatus();
    } else {
      setStatus("error");
      setMessage("No project ID provided");
    }
  }, [projectId]);

  return (
    <div className="flex items-center space-x-2 text-xs">
      <div
        className={`h-2 w-2 rounded-full ${
          status === "connected"
            ? "bg-green-500"
            : status === "loading"
              ? "animate-pulse bg-yellow-500"
              : "bg-red-500"
        }`}
      ></div>
      <span
        className={
          status === "connected" ? "text-muted-foreground" : "text-red-500"
        }
      >
        {message}
      </span>
    </div>
  );
}
