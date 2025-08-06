export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
export type AnimationProvider = 'runway' | 'bytedance';
export type DataSourceType = 'csv' | 'xlsx' | 'google-sheets';
export type BulkVideoStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type SceneStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type RenderStatus = 'pending' | 'rendering' | 'completed' | 'failed';

export interface BulkVideoProjectSettings {
  brandLogoUrl: string;
  logoPosition: LogoPosition;
  logoSize: {
    width: number;
    height: number;
  };
  defaultVideoStyle: string;
  defaultFormats: string[];
  defaultImageStyle: string;
  defaultImageStylePreset?: string;
  defaultAnimationProvider: AnimationProvider;
  defaultDuration: number;
  defaultSceneCount: number;
  defaultCameraFixed?: boolean;
  defaultUseEndImage?: boolean;
  defaultAnimationPromptMode?: 'ai' | 'template';
  defaultAnimationTemplate?: string;
}

export interface BulkVideoData {
  textContent: string;
  productImageUrl?: string;
  customImageStyle?: string;
  customFormats?: string[];
  customAnimationProvider?: AnimationProvider;
  customDuration?: number;
  customSceneCount?: number;
  customCameraFixed?: boolean;
  customUseEndImage?: boolean;
  customAnimationPromptMode?: 'ai' | 'template';
  customAnimationTemplate?: string;
}

export interface BulkVideoImportData {
  dataSourceType: DataSourceType;
  dataSourceUrl?: string;
  uploadedFile?: File;
  videos: BulkVideoData[];
}

export interface BulkVideoGenerationProgress {
  projectId: string;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  currentVideo?: {
    id: string;
    status: string;
    progress: number;
  };
  estimatedTimeRemaining?: number;
}

export interface LogoOverlayConfig {
  logoUrl: string;
  position: LogoPosition;
  size: {
    width: number;
    height: number;
  };
  padding?: number;
}

export interface CropSettings {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface FormatRenderConfig {
  format: string;
  width: number;
  height: number;
  crop: CropSettings;
  logoPosition: {
    x: number;
    y: number;
  };
}