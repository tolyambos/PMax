import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { videoService } from "@/app/utils/video/video-service";
import { s3Utils } from "@/lib/s3-utils";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { initializeExport, updateExportProgress, updateProjectStatus, cleanupExport } from "@/app/utils/bulk-export-progress";

// Schema for bulk export requests
const BulkExportRequestSchema = z.object({
  projectIds: z.array(z.string().min(1)).min(1),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
  quality: z.enum(["high", "medium", "low"]).default("high"),
});

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    console.log("Bulk video export request received");

    // Validate request
    try {
      body = BulkExportRequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return NextResponse.json(
          { error: "Validation error", details: errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    const { projectIds, format, quality } = body;
    
    // Generate unique export ID
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Starting bulk export for ${projectIds.length} projects with ID: ${exportId}`);

    // Get project names for progress tracking
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true }
    });

    // Initialize progress tracking
    console.log(`[BULK-EXPORT] Initializing export ${exportId} with ${projects.length} projects`);
    initializeExport(exportId, projectIds, projects);
    console.log(`[BULK-EXPORT] Export ${exportId} initialized successfully`);

    // Start the export process asynchronously
    console.log(`[BULK-EXPORT] Starting async processing for export ${exportId}`);
    processExportAsync(exportId, projectIds, format, quality);

    // Return the export ID immediately
    return NextResponse.json({
      success: true,
      exportId,
      message: "Export started successfully"
    });

  } catch (error) {
    console.error("Unexpected error processing video export:", error);
    return NextResponse.json(
      { error: "Internal server error during video export" },
      { status: 500 }
    );
  }
}

// Async function to process the export in the background
async function processExportAsync(
  exportId: string, 
  projectIds: string[], 
  format?: "9:16" | "16:9" | "1:1" | "4:5",
  quality: "high" | "medium" | "low" = "high"
) {
  try {
    updateExportProgress(exportId, { status: 'processing', progress: 10 });

    // Create temporary directory for the export
    const tempDir = path.join(process.cwd(), "temp", `bulk-export-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const exportResults = [];
    const errors = [];

    try {
      // Process each project
      for (let i = 0; i < projectIds.length; i++) {
        const projectId = projectIds[i];
        
        try {
          // Update progress - project starting
          updateProjectStatus(exportId, projectId, 'processing');
          updateExportProgress(exportId, {
            progress: Math.round((i / projectIds.length) * 70) + 10
          });

          console.log(`Processing project: ${projectId}`);

          // Fetch project data
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
              scenes: {
                orderBy: { order: "asc" },
                include: {
                  elements: true,
                },
              },
            },
          });

          if (!project) {
            console.error(`Project not found: ${projectId}`);
            errors.push({ projectId, error: "Project not found" });
            updateProjectStatus(exportId, projectId, 'error', "Project not found");
            continue;
          }

          // Convert database scenes to export format
          const scenes = project.scenes.map((scene) => ({
            id: scene.id,
            order: scene.order,
            imageUrl: scene.imageUrl || "",
            duration: scene.duration ? (scene.duration > 100 ? scene.duration / 1000 : scene.duration) : 3,
            backgroundColor: undefined as string | undefined,
            prompt: scene.prompt || undefined,
            imagePrompt: scene.prompt || undefined,
            animate: scene.animate ? Boolean(scene.animate) : undefined,
            videoUrl: scene.videoUrl || undefined,
            animationStatus: scene.animationStatus || undefined,
            animationPrompt: scene.animationPrompt || undefined,
            elements: scene.elements.map((element) => ({
              id: element.id,
              type: element.type,
              content: element.content || undefined,
              x: Number(element.x),
              y: Number(element.y),
              width: element.width ? Number(element.width) : undefined,
              height: element.height ? Number(element.height) : undefined,
              rotation: Number(element.rotation),
              opacity: Number(element.opacity),
              zIndex: Number(element.zIndex),
              assetId: element.assetId || undefined,
              url: element.url || undefined,
            })),
            projectId: scene.projectId,
          }));

          // Use project format if not specified in request
          const projectFormat = format || (project.format as "9:16" | "16:9" | "1:1" | "4:5");

          // Force FFmpeg rendering in development mode if FORCE_RENDER=true
          const forceRender = process.env.FORCE_RENDER === "true";
          const useMockExport = process.env.NODE_ENV === "development" && !forceRender;

          let videoBuffer: Buffer;
          let filename: string;

          if (useMockExport) {
            console.log(`Using mock export for project: ${projectId}`);
            
            // Create a small static video file for testing
            const base64Mp4 = "AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tAAAAH21vb3YAAABsbXZoZAAAAADaAE8D2gBPAwAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIYdHJhawAAAFx0a2hkAAAAB9oATwPaAE8DAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAACgAAAAWgAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABANoATwMAAAAAAAEAAAAAAbWbWRpYQAAACBtZGhkAAAAANoATwPaAE8DAAAAAAAAAAAAAAAAAAAA////SAAAAg1wcm90b19wbGF5ZXJfbWluaW1hbC5qcw0NCgA=";
            videoBuffer = Buffer.from(base64Mp4, "base64");
            filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}-${projectId}-mock.mp4`;
          } else {
            console.log(`Rendering video for project: ${projectId}`);
            
            // Process scenes - fix animation and duration
            const processedScenes = scenes.map((scene, index) => {
              const validDuration = typeof scene.duration === "number" 
                ? Math.max(0.1, scene.duration) 
                : Math.max(0.1, parseFloat(String(scene.duration)) || 3);

              const useAnimation = Boolean(scene.videoUrl && scene.animate !== false);

              return {
                ...scene,
                animate: useAnimation,
                duration: validDuration,
              };
            });

            // Render the video
            const videoFilePath = await videoService.renderVideo({
              projectId,
              scenes: processedScenes,
              format: projectFormat,
              quality,
            });

            // Calculate total duration for filename checking
            const totalDuration = processedScenes.reduce((total, scene) => total + (scene.duration || 3), 0);

            // Check for the file with duration in filename
            let actualVideoFilePath = videoFilePath;
            if (!fs.existsSync(videoFilePath)) {
              const durationPath = videoFilePath.replace(".mp4", `-${totalDuration}s.mp4`);
              if (fs.existsSync(durationPath)) {
                actualVideoFilePath = durationPath;
              } else {
                // Look for any MP4 in the directory as last resort
                const dir = path.dirname(videoFilePath);
                const files = fs.readdirSync(dir);
                const mp4File = files.find((f) => f.endsWith(".mp4"));
                if (mp4File) {
                  actualVideoFilePath = path.join(dir, mp4File);
                }
              }
            }

            if (!fs.existsSync(actualVideoFilePath)) {
              console.error(`Video file not found for project: ${projectId}`);
              errors.push({ projectId, error: "Failed to render video" });
              updateProjectStatus(exportId, projectId, 'error', "Failed to render video");
              continue;
            }

            videoBuffer = await fs.promises.readFile(actualVideoFilePath);
            filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}-${projectId}.mp4`;

            // Clean up render directory
            try {
              const renderDir = path.dirname(actualVideoFilePath);
              if (renderDir.includes("render-")) {
                await fs.promises.rm(renderDir, { recursive: true, force: true });
                console.log("Cleaned up render directory:", renderDir);
              }
            } catch (cleanupError) {
              console.error("Failed to clean up render directory:", cleanupError);
            }
          }

          // Save video to temp directory
          const tempVideoPath = path.join(tempDir, filename);
          await fs.promises.writeFile(tempVideoPath, videoBuffer);

          exportResults.push({
            projectId,
            projectName: project.name,
            filename,
            fileSize: videoBuffer.length,
            success: true,
          });

          // Update progress - project completed
          updateProjectStatus(exportId, projectId, 'completed');
          updateExportProgress(exportId, {
            progress: Math.round(((i + 1) / projectIds.length) * 70) + 10
          });

          console.log(`Successfully processed project: ${projectId}`);

        } catch (projectError) {
          console.error(`Error processing project ${projectId}:`, projectError);
          const errorMessage = projectError instanceof Error ? projectError.message : "Unknown error";
          errors.push({ projectId, error: errorMessage });
          updateProjectStatus(exportId, projectId, 'error', errorMessage);
        }
      }

      // Packaging phase
      updateExportProgress(exportId, { status: 'packaging', progress: 85 });

      // Create ZIP archive
      const zipPath = path.join(tempDir, `bulk-export-${Date.now()}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      // Handle archive events
      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(output);

      // Add all video files to archive
      for (const result of exportResults) {
        const videoPath = path.join(tempDir, result.filename);
        if (fs.existsSync(videoPath)) {
          archive.file(videoPath, { name: result.filename });
        }
      }

      // Add a summary file
      const summaryContent = JSON.stringify({
        exportDate: new Date().toISOString(),
        totalProjects: projectIds.length,
        successful: exportResults.length,
        failed: errors.length,
        results: exportResults,
        errors: errors,
        settings: {
          format: format || "project-specific",
          quality,
        },
      }, null, 2);

      archive.append(summaryContent, { name: 'export-summary.json' });

      // Finalize the archive
      await archive.finalize();

      // Wait for the output stream to finish
      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
      });

      // Read the ZIP file and convert to download URL (or use a temporary URL service)
      const zipBuffer = await fs.promises.readFile(zipPath);
      
      // For now, we'll use a simple approach - store the file temporarily and provide a download endpoint
      const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const downloadPath = path.join(process.cwd(), "temp", "downloads", `${downloadId}.zip`);
      
      // Ensure downloads directory exists
      fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
      fs.copyFileSync(zipPath, downloadPath);
      
      // Update progress - complete with download path
      updateExportProgress(exportId, { 
        status: 'complete', 
        progress: 100,
        downloadUrl: `/api/download?path=${encodeURIComponent(downloadPath)}`
      });

      // Clean up temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log("Cleaned up temp directory:", tempDir);
      } catch (cleanupError) {
        console.error("Failed to clean up temp directory:", cleanupError);
      }

      // Schedule cleanup of export progress after 1 hour
      cleanupExport(exportId);

      console.log(`Bulk export completed: ${exportResults.length} successful, ${errors.length} failed`);

    } catch (error) {
      // Clean up temp directory on error
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Failed to clean up temp directory:", cleanupError);
      }
      
      throw error;
    }

  } catch (error) {
    console.error("Unexpected error during bulk export:", error);
    updateExportProgress(exportId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    });
  }
}


// Handle HEAD requests to check if the endpoint is available
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}