/**
 * Centralized video dimensions configuration
 * This ensures consistency across scene generation, video export, and UI
 */

export interface VideoDimensions {
  width: number;
  height: number;
}

export interface VideoFormatConfig {
  name: string;
  width: number;
  height: number;
  ratio: number;
}

// Master video format configuration - single source of truth
// Using dimensions that are multiples of 64 for AI image generation compatibility
export const VIDEO_FORMATS = {
  "9:16": { name: "Vertical (9:16)", width: 1088, height: 1920, ratio: 9 / 16 },
  "16:9": {
    name: "Landscape (16:9)",
    width: 1920,
    height: 1088,
    ratio: 16 / 9,
  },
  "1:1": { name: "Square (1:1)", width: 1536, height: 1536, ratio: 1 },
  "4:5": { name: "Instagram (4:5)", width: 1216, height: 1536, ratio: 4 / 5 },
} as const;

export type VideoFormat = keyof typeof VIDEO_FORMATS;

/**
 * Get video dimensions for a given format
 */
export function getDimensionsFromFormat(format: string): VideoDimensions {
  const formatConfig = VIDEO_FORMATS[format as VideoFormat];
  if (!formatConfig) {
    console.warn(`Unknown video format: ${format}, defaulting to 9:16`);
    return VIDEO_FORMATS["9:16"];
  }

  return {
    width: formatConfig.width,
    height: formatConfig.height,
  };
}

/**
 * Get format configuration for a given format
 */
export function getFormatConfig(format: string): VideoFormatConfig {
  const formatConfig = VIDEO_FORMATS[format as VideoFormat];
  if (!formatConfig) {
    console.warn(`Unknown video format: ${format}, defaulting to 9:16`);
    return VIDEO_FORMATS["9:16"];
  }

  return formatConfig;
}

/**
 * Validate if a format string is valid
 */
export function isValidFormat(format: string): format is VideoFormat {
  return format in VIDEO_FORMATS;
}
