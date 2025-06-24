import fs from 'fs';
import path from 'path';

/**
 * Clean up old download files in the temp/downloads directory
 * This function removes files older than the specified age
 */
export function cleanupOldDownloads(maxAgeHours: number = 24) {
  const downloadsDir = path.join(process.cwd(), 'temp', 'downloads');
  
  if (!fs.existsSync(downloadsDir)) {
    console.log('[CLEANUP] Downloads directory does not exist, skipping cleanup');
    return;
  }

  try {
    const files = fs.readdirSync(downloadsDir);
    let cleanedCount = 0;
    let totalSize = 0;

    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(downloadsDir, file);
      
      try {
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();
        
        if (fileAge > maxAgeMs) {
          const fileSize = stats.size;
          fs.unlinkSync(filePath);
          cleanedCount++;
          totalSize += fileSize;
          console.log(`[CLEANUP] Removed old download file: ${file} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      } catch (fileError) {
        console.error(`[CLEANUP] Error processing file ${file}:`, fileError);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[CLEANUP] Cleaned up ${cleanedCount} files, freed ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.log('[CLEANUP] No old download files to clean up');
    }
  } catch (error) {
    console.error('[CLEANUP] Error during downloads cleanup:', error);
  }
}

/**
 * Start periodic cleanup of download files
 * Runs cleanup every hour by default
 */
export function startPeriodicCleanup(intervalHours: number = 1, maxAgeHours: number = 24) {
  console.log(`[CLEANUP] Starting periodic cleanup every ${intervalHours}h for files older than ${maxAgeHours}h`);
  
  // Run cleanup immediately
  cleanupOldDownloads(maxAgeHours);
  
  // Schedule periodic cleanup
  setInterval(() => {
    cleanupOldDownloads(maxAgeHours);
  }, intervalHours * 60 * 60 * 1000);
}