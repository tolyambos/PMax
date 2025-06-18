import fs from "fs";
import path from "path";

/**
 * Service for cleaning up temporary files and directories
 */
export class CleanupService {
  /**
   * Clean up old render directories
   * @param maxAgeMinutes - Maximum age in minutes for directories to keep
   */
  static async cleanupOldRenderDirectories(maxAgeMinutes: number = 60): Promise<void> {
    try {
      const projectRoot = process.cwd();
      const rendersDir = path.join(projectRoot, "renders");
      
      if (!fs.existsSync(rendersDir)) {
        console.log("No renders directory found, nothing to clean up");
        return;
      }

      const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
      const renderDirs = fs.readdirSync(rendersDir)
        .filter(dir => dir.startsWith("render-"))
        .map(dir => path.join(rendersDir, dir));

      let cleanedCount = 0;
      let totalSize = 0;

      for (const renderDir of renderDirs) {
        try {
          const stats = fs.statSync(renderDir);
          if (stats.mtime.getTime() < cutoffTime) {
            // Calculate directory size before deletion
            const dirSize = this.getDirectorySize(renderDir);
            totalSize += dirSize;
            
            await fs.promises.rm(renderDir, { recursive: true, force: true });
            console.log(`Cleaned up old render directory: ${renderDir} (${this.formatBytes(dirSize)})`);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`Failed to clean up render directory ${renderDir}:`, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleanup complete: Removed ${cleanedCount} old render directories, freed ${this.formatBytes(totalSize)}`);
      } else {
        console.log("No old render directories found to clean up");
      }
    } catch (error) {
      console.error("Error during render directory cleanup:", error);
    }
  }

  /**
   * Clean up a specific render directory
   * @param renderDirPath - Path to the render directory to clean up
   */
  static async cleanupRenderDirectory(renderDirPath: string): Promise<void> {
    try {
      if (fs.existsSync(renderDirPath) && renderDirPath.includes("render-")) {
        const dirSize = this.getDirectorySize(renderDirPath);
        await fs.promises.rm(renderDirPath, { recursive: true, force: true });
        console.log(`Cleaned up render directory: ${renderDirPath} (${this.formatBytes(dirSize)})`);
      }
    } catch (error) {
      console.error(`Failed to clean up render directory ${renderDirPath}:`, error);
    }
  }

  /**
   * Clean up temporary animation files
   * @param maxAgeMinutes - Maximum age in minutes for files to keep
   */
  static async cleanupTempAnimationFiles(maxAgeMinutes: number = 30): Promise<void> {
    try {
      const tempDir = require("os").tmpdir();
      const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
      
      if (!fs.existsSync(tempDir)) return;

      const files = fs.readdirSync(tempDir);
      let cleanedCount = 0;
      let totalSize = 0;

      for (const file of files) {
        if (file.includes("animation") && (file.endsWith(".mp4") || file.endsWith(".mov"))) {
          const filePath = path.join(tempDir, file);
          try {
            const stats = fs.statSync(filePath);
            if (stats.mtime.getTime() < cutoffTime) {
              totalSize += stats.size;
              await fs.promises.unlink(filePath);
              console.log(`Cleaned up old animation file: ${filePath} (${this.formatBytes(stats.size)})`);
              cleanedCount++;
            }
          } catch (error) {
            console.error(`Failed to clean up animation file ${filePath}:`, error);
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`Animation cleanup complete: Removed ${cleanedCount} old files, freed ${this.formatBytes(totalSize)}`);
      }
    } catch (error) {
      console.error("Error during animation file cleanup:", error);
    }
  }

  /**
   * Get the total size of a directory recursively
   * @param dirPath - Path to the directory
   * @returns Size in bytes
   */
  private static getDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`Error calculating directory size for ${dirPath}:`, error);
    }
    
    return totalSize;
  }

  /**
   * Format bytes into human-readable format
   * @param bytes - Number of bytes
   * @returns Formatted string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Run comprehensive cleanup of all temporary files
   * @param options - Cleanup options
   */
  static async runFullCleanup(options: {
    renderDirMaxAge?: number;
    animationFileMaxAge?: number;
  } = {}): Promise<void> {
    const {
      renderDirMaxAge = 60,
      animationFileMaxAge = 30
    } = options;

    console.log("Starting comprehensive temporary file cleanup...");
    
    await Promise.all([
      this.cleanupOldRenderDirectories(renderDirMaxAge),
      this.cleanupTempAnimationFiles(animationFileMaxAge)
    ]);
    
    console.log("Comprehensive cleanup completed");
  }
}