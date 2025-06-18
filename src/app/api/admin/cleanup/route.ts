import { NextResponse } from "next/server";
import { CleanupService } from "@/app/utils/cleanup-service";

/**
 * Admin endpoint for manual cleanup of temporary files
 * This can also be called by cron jobs or monitoring systems
 */
export async function POST(req: Request) {
  try {
    // Parse request body for cleanup options
    let options = {};
    try {
      const body = await req.json();
      options = body || {};
    } catch {
      // Use default options if no body provided
    }

    console.log("Starting manual cleanup via API endpoint");

    // Run comprehensive cleanup
    await CleanupService.runFullCleanup(options);

    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error during manual cleanup:", error);
    
    return NextResponse.json(
      { 
        error: "Cleanup failed", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check cleanup status and stats
 */
export async function GET() {
  try {
    const fs = await import("fs");
    const path = await import("path");
    
    const projectRoot = process.cwd();
    const rendersDir = path.join(projectRoot, "renders");
    
    let stats = {
      renderDirectories: 0,
      totalRenderSize: 0,
      oldestRenderDir: null as string | null,
      newestRenderDir: null as string | null
    };

    let oldestTime = Infinity;
    let newestTime = 0;

    if (fs.existsSync(rendersDir)) {
      const renderDirs = fs.readdirSync(rendersDir)
        .filter(dir => dir.startsWith("render-"))
        .map(dir => path.join(rendersDir, dir));

      stats.renderDirectories = renderDirs.length;

      for (const renderDir of renderDirs) {
        try {
          const dirStats = fs.statSync(renderDir);
          const mtime = dirStats.mtime.getTime();
          
          if (mtime < oldestTime) {
            oldestTime = mtime;
            stats.oldestRenderDir = path.basename(renderDir);
          }
          
          if (mtime > newestTime) {
            newestTime = mtime;
            stats.newestRenderDir = path.basename(renderDir);
          }

          // Calculate directory size (simplified)
          const files = fs.readdirSync(renderDir);
          for (const file of files) {
            const filePath = path.join(renderDir, file);
            const fileStats = fs.statSync(filePath);
            if (fileStats.isFile()) {
              stats.totalRenderSize += fileStats.size;
            }
          }
        } catch (error) {
          console.error(`Error processing render directory ${renderDir}:`, error);
        }
      }
    }

    // Format size for display
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        totalRenderSizeFormatted: formatBytes(stats.totalRenderSize),
        oldestRenderAge: stats.oldestRenderDir && oldestTime !== Infinity
          ? `${Math.round((Date.now() - oldestTime) / (1000 * 60))} minutes`
          : null,
        newestRenderAge: stats.newestRenderDir && newestTime > 0
          ? `${Math.round((Date.now() - newestTime) / (1000 * 60))} minutes`
          : null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error getting cleanup stats:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get cleanup stats", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}