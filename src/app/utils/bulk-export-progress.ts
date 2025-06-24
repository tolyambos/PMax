// Use global variable to persist across hot reloads in development
declare global {
  var _exportProgressManager: ExportProgressManager | undefined;
}

// Singleton pattern to ensure the same Map instance is used across all imports
class ExportProgressManager {
  private exportProgress = new Map<string, {
    status: 'preparing' | 'processing' | 'packaging' | 'complete' | 'error';
    progress: number;
    projects: Array<{
      id: string;
      name: string;
      status: 'pending' | 'processing' | 'completed' | 'error';
      error?: string;
    }>;
    downloadUrl?: string;
    error?: string;
  }>();

  private constructor() {
    console.log('[PROGRESS-MANAGER] Creating new instance');
  }

  public static getInstance(): ExportProgressManager {
    // In development, use global variable to persist across hot reloads
    if (process.env.NODE_ENV === 'development') {
      if (!global._exportProgressManager) {
        global._exportProgressManager = new ExportProgressManager();
        console.log('[PROGRESS-MANAGER] Created new singleton instance (dev mode)');
      }
      return global._exportProgressManager;
    }
    
    // In production, use static instance
    if (!ExportProgressManager._instance) {
      ExportProgressManager._instance = new ExportProgressManager();
      console.log('[PROGRESS-MANAGER] Created new singleton instance (prod mode)');
    }
    return ExportProgressManager._instance;
  }
  
  private static _instance: ExportProgressManager;

  public getProgress(exportId: string) {
    console.log(`[PROGRESS-MANAGER] Getting progress for ${exportId}, total exports: ${this.exportProgress.size}`);
    return this.exportProgress.get(exportId);
  }

  public setProgress(exportId: string, data: any) {
    console.log(`[PROGRESS-MANAGER] Setting progress for ${exportId}`);
    this.exportProgress.set(exportId, data);
    console.log(`[PROGRESS-MANAGER] Total exports after set: ${this.exportProgress.size}`);
  }

  public updateProgress(exportId: string, update: any) {
    const existing = this.exportProgress.get(exportId) || {
      status: 'preparing' as const,
      progress: 0,
      projects: [],
    };
    
    this.exportProgress.set(exportId, { ...existing, ...update });
    console.log(`[PROGRESS-MANAGER] Updated progress for ${exportId}`);
  }

  public deleteProgress(exportId: string) {
    this.exportProgress.delete(exportId);
    console.log(`[PROGRESS-MANAGER] Deleted progress for ${exportId}`);
  }

  public getAllExports() {
    return {
      totalExports: this.exportProgress.size,
      exports: Array.from(this.exportProgress.keys()),
      details: Array.from(this.exportProgress.entries()).map(([id, data]) => ({
        id,
        status: data.status,
        progress: data.progress,
        projectCount: data.projects.length
      }))
    };
  }
}

// Get the singleton instance
const progressManager = ExportProgressManager.getInstance();

export function getExportProgress(exportId: string) {
  return progressManager.getProgress(exportId);
}

export function updateExportProgress(exportId: string, update: Partial<{
  status: 'preparing' | 'processing' | 'packaging' | 'complete' | 'error';
  progress: number;
  projects: Array<{
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    error?: string;
  }>;
  downloadUrl?: string;
  error?: string;
}>) {
  progressManager.updateProgress(exportId, update);
}

export function updateProjectStatus(
  exportId: string, 
  projectId: string, 
  status: 'pending' | 'processing' | 'completed' | 'error',
  error?: string
) {
  const existing = progressManager.getProgress(exportId);
  if (!existing) return;

  const updatedProjects = existing.projects.map(p => 
    p.id === projectId ? { ...p, status, error } : p
  );

  progressManager.updateProgress(exportId, { 
    projects: updatedProjects 
  });
}

export function initializeExport(exportId: string, projectIds: string[], projectsData: Array<{ id: string; name: string }>) {
  console.log(`[PROGRESS-UTIL] Initializing export ${exportId} with ${projectIds.length} project IDs`);
  
  const projects = projectIds.map(id => {
    const project = projectsData.find(p => p.id === id);
    return {
      id,
      name: project?.name || `Project ${id}`,
      status: 'pending' as const,
    };
  });

  console.log(`[PROGRESS-UTIL] Created project list for ${exportId}:`, projects.map(p => p.name));

  progressManager.setProgress(exportId, {
    status: 'preparing',
    progress: 0,
    projects,
  });

  console.log(`[PROGRESS-UTIL] Export ${exportId} initialized.`);
}

export function cleanupExport(exportId: string) {
  // Clean up progress data after 10 minutes
  setTimeout(() => {
    progressManager.deleteProgress(exportId);
  }, 10 * 60 * 1000);
}

export function getAllExports() {
  return progressManager.getAllExports();
}