"use client";

import { useEffect, useState } from "react";

interface DatabaseStatus {
  status: "connected" | "disconnected" | "error";
  database: string;
  timestamp: string;
  message?: string;
}

export default function DatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/db-status");
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch database status:", error);
        setStatus({
          status: "error",
          database: "Unknown",
          timestamp: new Date().toISOString(),
          message: "Failed to fetch status",
        });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span className="text-muted-foreground">Checking database...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div
        className={`h-2 w-2 rounded-full ${
          status.status === "connected"
            ? "bg-green-500"
            : status.status === "disconnected"
              ? "bg-red-500"
              : "bg-yellow-500"
        }`}
      ></div>
      <span
        className={
          status.status === "connected"
            ? "text-muted-foreground"
            : "text-red-500"
        }
      >
        {status.status === "connected"
          ? `${status.database} connected`
          : status.status === "disconnected"
            ? `${status.database} disconnected`
            : `Database error: ${status.message || "Unknown error"}`}
      </span>
    </div>
  );
}
