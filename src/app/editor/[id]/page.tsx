/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ui/use-toast";
import NavigationWrapper from "@/app/components/editor/navigation-wrapper";
import { EditorProvider } from "@/app/components/editor/context/editor-context";
import SceneCanvas from "@/app/components/editor/scene-canvas";
import Timeline from "@/app/components/editor/timeline";
import SidePanel from "@/app/components/editor/side-panel";
import { FormatProvider } from "../../contexts/format-context";
import { mockScenes } from "@/app/mock-data";
import { api as trpc } from "@/app/utils/trpc";
import app from "next/app";
import { GOOGLE_FONTS } from "@/app/utils/fonts";

// Extend Window interface to include our custom property
declare global {
  interface Window {
    __fontsPreloaded?: boolean;
  }
}

export default function EditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("Sample Project");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [projectFormat, setProjectFormat] = useState<
    "9:16" | "16:9" | "1:1" | "4:5"
  >("9:16");

  // Sanitize and validate the ID parameter
  const sanitizedId = params.id || "";

  // Create a validated input object for tRPC
  const tRPCInput =
    sanitizedId && sanitizedId !== "undefined" && sanitizedId !== "null"
      ? { id: sanitizedId }
      : undefined;

  // Get project data from tRPC
  const projectQuery = trpc.project.getById.useQuery(tRPCInput, {
    enabled: !!tRPCInput,
    retry: 3,
    retryDelay: 1000,
    onError: (error) => {
      console.error("[EDITOR]: Error fetching project data:", error);
      fetchProjectDirectly(sanitizedId);
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("mockUser");
    toast({
      title: "Logged out successfully",
    });
    router.push("/");
  };

  // Function to handle direct sync with the database
  const syncEditorState = useCallback(async (): Promise<void> => {
    if (!params.id) return;

    try {
      setIsSaving(true);
      console.log("[EDITOR]: Syncing editor state with database");

      // The actual sync is handled by the EditorProvider
      // This is just for UI feedback

      // For testing, simulate a successful save after a short delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      setLastSaved(new Date());
    } catch (error) {
      console.error("[EDITOR]: Error syncing with database:", error);
      toast({
        title: "Failed to save",
        description:
          "Your changes couldn't be saved to the database. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [params.id, toast]);

  // Function to directly fetch project data from API (bypassing tRPC)
  const fetchProjectDirectly = async (projectId: string) => {
    try {
      console.log("[EDITOR]: Fetching project directly:", projectId);

      const response = await fetch(
        `/api/db-check/project-data?id=${encodeURIComponent(projectId)}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.project) {
          console.log(
            "[EDITOR]: Successfully fetched project from db-check API:",
            data.project.name
          );

          setProjectName(data.project.name);
          if (
            data.project.format &&
            ["9:16", "16:9", "1:1", "4:5"].includes(data.project.format)
          ) {
            setProjectFormat(
              data.project.format as "9:16" | "16:9" | "1:1" | "4:5"
            );
          }
          setIsLoading(false);
          return data.project;
        }
      }

      // If that fails, try the debug API
      const debugResponse = await fetch(
        `/api/debug-project?id=${encodeURIComponent(projectId)}`
      );

      if (debugResponse.ok) {
        const debugData = await debugResponse.json();
        if (debugData.success && debugData.project) {
          console.log(
            "[EDITOR]: Successfully fetched project from debug API:",
            debugData.project.name
          );

          setProjectName(debugData.project.name);
          if (
            debugData.project.format &&
            ["9:16", "16:9", "1:1", "4:5"].includes(debugData.project.format)
          ) {
            setProjectFormat(
              debugData.project.format as "9:16" | "16:9" | "1:1" | "4:5"
            );
          }
          setIsLoading(false);
          return debugData.project;
        }
      }

      console.error("[EDITOR]: Failed to fetch project directly");
      return null;
    } catch (error) {
      console.error("[EDITOR]: Error fetching project directly:", error);
      return null;
    }
  };

  // Handle loading data from the tRPC query
  useEffect(() => {
    if (projectQuery.data && !projectQuery.isLoading) {
      setProjectName(projectQuery.data.name);
      // Set project format if available, otherwise keep default
      if (
        projectQuery.data.format &&
        ["9:16", "16:9", "1:1", "4:5"].includes(projectQuery.data.format)
      ) {
        setProjectFormat(
          projectQuery.data.format as "9:16" | "16:9" | "1:1" | "4:5"
        );
      }
      setIsLoading(false);
    }
  }, [projectQuery.data, projectQuery.isLoading]);

  // Preload all fonts when the editor page loads
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Use the fonts utility to preload local fonts
    const loadAllFonts = async () => {
      try {
        const { preloadAllFonts, FALLBACK_FONTS } = await import(
          "@/app/utils/fonts"
        );

        // Preload the local fonts
        await preloadAllFonts(20); // Limit to 20 fonts for performance

        // Add CSS for local font files
        const fontFaceRules = FALLBACK_FONTS.map((font) => {
          return Object.entries(font.files)
            .map(
              ([weight, file]) => `
            @font-face {
              font-family: "${font.family}";
              src: url("${file}") format("truetype");
              font-weight: ${weight};
              font-style: normal;
              font-display: swap;
            }
          `
            )
            .join("");
        }).join("");

        const style = document.createElement("style");
        style.setAttribute("data-local-fonts", "true");
        style.textContent = fontFaceRules;
        document.head.appendChild(style);

        // Set a global flag to indicate fonts are loaded
        window.__fontsPreloaded = true;

        console.log("Preloaded local fonts for the editor");
      } catch (error) {
        console.error("Error loading fonts:", error);
      }
    };

    loadAllFonts();
  }, []);

  return (
    <FormatProvider initialFormat={projectFormat}>
      <EditorProvider projectId={params.id}>
        <div className="flex overflow-hidden flex-col h-screen">
          {/* Navigation */}
          <NavigationWrapper
            projectName={projectName}
            projectId={params.id}
            onLogout={handleLogout}
            isLoading={isLoading || projectQuery.isLoading}
            isSaving={isSaving}
            lastSaved={lastSaved}
            onSave={syncEditorState}
          />

          <div className="flex overflow-hidden flex-1">
            {/* Main Editor Area */}
            <div className="flex overflow-hidden relative flex-col flex-1">
              <div className="flex flex-1 justify-center items-center p-6 bg-muted/30">
                {isLoading || projectQuery.isLoading ? (
                  <div className="flex justify-center items-center">
                    <div className="w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
                    <span className="ml-2">Loading project...</span>
                  </div>
                ) : (
                  <SceneCanvas />
                )}
              </div>

              {/* Timeline - sticky on desktop, fixed on mobile */}
              <div className="w-full md:sticky md:bottom-0 md:z-10">
                <Timeline
                  scenes={[]} // The Timeline will get scenes from context
                  selectedSceneId={null} // The Timeline will get selectedSceneId from context
                  onSelectScene={() => {}} // The Timeline will use context
                  onReorderScenes={() => {}} // The Timeline will use context
                  onDeleteScene={() => {}} // The Timeline will use context
                  onAddScene={() => {}} // The Timeline will use context
                  onAddAssetToScene={() => {}} // The Timeline will use context
                />
              </div>
            </div>

            {/* Side Panel */}
            <SidePanel
              scenes={[]} // The SidePanel will get scenes from context
              selectedSceneId={null} // The SidePanel will get selectedSceneId from context
              selectedElementId={null} // The SidePanel will get selectedElementId from context
              onAddScenes={() => {}} // The SidePanel will use context
              onDeleteElement={() => {}} // The SidePanel will use context
              onResizeElement={() => {}} // The SidePanel will use context
              onMoveElement={() => {}} // The SidePanel will use context
              onRotateElement={() => {}} // The SidePanel will use context
              onUpdateSceneDuration={() => {}} // The SidePanel will use handleUpdateSceneDuration from context
              onUpdateSceneBackground={() => {}} // The SidePanel will use context
              onToggleAnimation={() => {}} // The SidePanel will use context
              onUpdateElement={() => {}} // The SidePanel will use context
              onElementSelect={() => {}} // The SidePanel will use context
              onSetGlobalElement={() => {}} // The SidePanel will use context
              globalElements={new Set()} // The SidePanel will get globalElements from context
            />
          </div>
        </div>
      </EditorProvider>
    </FormatProvider>
  );
}
