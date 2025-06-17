import { z } from "zod";

/**
 * Shared type definitions for the video rendering system
 */

/**
 * Video render options schema definition - Updated to match your application's types
 */
export const VideoRenderOptionsSchema = z.object({
  scenes: z.array(
    z.object({
      id: z.string().optional(),
      order: z.number().optional(),
      imageUrl: z.string().url(),
      duration: z.number().min(0.1).max(60).default(3),
      backgroundColor: z.string().optional(),
      prompt: z.string().optional(),
      imagePrompt: z.string().optional(),
      animate: z.boolean().optional(),
      videoUrl: z.string().optional(),
      animationStatus: z.string().optional(),
      animationPrompt: z.string().optional(),
      renderElementsServerSide: z.boolean().optional(),
      capturedWithElements: z.boolean().optional(),
      elements: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            content: z.string().optional(),
            x: z.number().default(0),
            y: z.number().default(0),
            width: z.number().optional(),
            height: z.number().optional(),
            rotation: z.number().default(0),
            opacity: z.number().default(1.0),
            zIndex: z.number().default(0),
            assetId: z.string().optional(),
            url: z.string().optional(),
          })
        )
        .optional(),
      projectId: z.string().optional(),
    })
  ),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  quality: z.enum(["high", "medium", "low"]).default("high"),
  projectId: z.string(),
  outputPath: z.string().optional(),
});

/**
 * Type definition for video render options
 */
export type VideoRenderOptions = z.infer<typeof VideoRenderOptionsSchema>;

/**
 * Type definition for a scene that matches your application structure
 */
export interface Scene {
  id?: string;
  order?: number;
  imageUrl: string;
  duration: number;
  backgroundColor?: string;
  prompt?: string;
  imagePrompt?: string;
  animate?: boolean;
  videoUrl?: string;
  animationStatus?: string;
  animationPrompt?: string;
  renderElementsServerSide?: boolean;
  capturedWithElements?: boolean;
  elements?: Element[];
  projectId?: string;
}

/**
 * Type definition for an element
 */
export interface Element {
  id: string;
  type: string;
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  assetId?: string;
  url?: string;
}

/**
 * Video quality settings type
 */
export interface VideoQualitySettings {
  bitrate: string;
  fps: number;
}

/**
 * Video dimensions type
 */
export interface VideoDimensions {
  width: number;
  height: number;
}

/**
 * Element types
 */
export type ElementType =
  | "text"
  | "shape"
  | "image"
  | "logo"
  | "video"
  | "audio"
  | "cta";

/**
 * Shape types for rendering
 */
export type ShapeType = "rectangle" | "circle" | "triangle";

/**
 * CTA (Call to Action) types
 */
export type CTAType = "button" | "banner" | "tag";

/**
 * Font definition
 */
export interface FontDefinition {
  family: string;
  weights: string[];
}

/**
 * Font file information
 */
export interface FontFile {
  path: string;
  family: string;
  weight: string;
  style?: string;
}

/**
 * Element render data
 */
export interface ElementRenderData {
  element: any;
  width: number;
  height: number;
  sceneIndex: number;
  ffmpegFilterCommands: string[];
}

/**
 * FFmpeg filter command
 */
export interface FFmpegFilterCommand {
  inputs: string[];
  filter: string;
  options: string | Record<string, any>;
  outputs: string[];
}

/**
 * Scene processing result
 */
export interface SceneProcessingResult {
  index: number;
  outputPath: string;
  isVideo: boolean;
  duration: number;
  elements?: any[];
}

/**
 * Frame list entry
 */
export interface FrameListEntry {
  filePath: string;
  duration: number;
}

/**
 * Parsed element content
 */
export interface ParsedElementContent {
  extractedContent: any;
  extractedText: string | null;
  extractedStyle: { [key: string]: string | number } | null;
  extractedShapeType: ShapeType | null;
  extractedCtaType: CTAType | null;
  extractedFontFamily: string | number | null;
  extractedFontWeight: string | number | null;
}
