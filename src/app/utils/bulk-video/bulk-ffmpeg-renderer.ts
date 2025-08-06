import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { 
  LogoPosition, 
  LogoOverlayConfig, 
  CropSettings, 
  FormatRenderConfig 
} from '@/app/types/bulk-video';

export interface BulkRenderOptions {
  masterVideo: string; // Path to master video (any dimensions)
  outputDir: string;
  formats: string[]; // e.g., ['1080x1920', '1920x1080', '1080x1080']
  logo: {
    path: string;
    position: LogoPosition;
    width: number;
    height: number;
    padding?: number;
  };
}

export interface RenderResult {
  format: string;
  outputPath: string;
  success: boolean;
  error?: string;
}

export class BulkFFmpegRenderer {
  /**
   * Concatenate multiple video files into one
   */
  async concatenateVideos(inputPaths: string[], outputPath: string): Promise<void> {
    // Create a temporary file list for ffmpeg concat
    const listPath = outputPath.replace('.mp4', '_list.txt');
    const fileContent = inputPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(listPath, fileContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('Starting concatenation:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Concatenating: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('error', async (err) => {
          await fs.unlink(listPath).catch(() => {});
          reject(err);
        })
        .on('end', async () => {
          await fs.unlink(listPath).catch(() => {});
          console.log('Concatenation complete');
          resolve();
        })
        .run();
    });
  }

  /**
   * Render multiple formats from a master video with logo overlay
   */
  async renderMultipleFormats(options: BulkRenderOptions): Promise<RenderResult[]> {
    const results: RenderResult[] = [];

    for (const format of options.formats) {
      try {
        const outputPath = await this.renderSingleFormat({
          ...options,
          format,
        });
        
        results.push({
          format,
          outputPath,
          success: true,
        });
      } catch (error) {
        results.push({
          format,
          outputPath: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Render a single format with crop and logo overlay
   */
  private async renderSingleFormat(options: BulkRenderOptions & { format: string }): Promise<string> {
    const [width, height] = options.format.split('x').map(Number);
    if (!width || !height) {
      throw new Error(`Invalid format: ${options.format}`);
    }

    const outputPath = path.join(options.outputDir, `output-${options.format}.mp4`);
    
    // Get actual video dimensions
    const videoInfo = await this.getVideoInfo(options.masterVideo);
    const videoStream = videoInfo.streams.find((s: any) => s.codec_type === 'video');
    if (!videoStream) {
      throw new Error('No video stream found in master video');
    }
    
    const sourceWidth = videoStream.width;
    const sourceHeight = videoStream.height;
    console.log(`Source video dimensions: ${sourceWidth}x${sourceHeight}`);
    
    // Calculate crop settings based on actual source dimensions
    const crop = this.calculateCropForSource(sourceWidth, sourceHeight, width, height);
    
    // Calculate logo position for this format
    const logoPos = this.calculateLogoPosition(
      options.logo.position,
      { width: options.logo.width, height: options.logo.height },
      { width, height },
      options.logo.padding
    );

    return new Promise((resolve, reject) => {
      // Build the complex filter
      const filterComplex = [
        // Step 1: Crop the video to target aspect ratio
        `[0:v]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}[cropped]`,
        // Step 2: Scale to final dimensions
        `[cropped]scale=${width}:${height}:flags=lanczos[scaled]`,
        // Step 3: Scale the logo
        `[1:v]scale=${options.logo.width}:${options.logo.height}[logo]`,
        // Step 4: Overlay the logo
        `[scaled][logo]overlay=${logoPos.x}:${logoPos.y}:format=auto[out]`
      ].join(';');

      ffmpeg()
        .input(options.masterVideo)
        .input(options.logo.path)
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[out]',
          '-map', '0:a?', // Include audio if present
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart', // Enable fast start for web playback
          '-c:a', 'aac',
          '-b:a', '128k'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log(`Rendering ${options.format}:`, cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`${options.format}: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('error', (err) => {
          console.error(`Error rendering ${options.format}:`, err);
          reject(err);
        })
        .on('end', () => {
          console.log(`Successfully rendered ${options.format}`);
          resolve(outputPath);
        })
        .run();
    });
  }

  /**
   * Calculate crop settings from 2048x2048 square to target aspect ratio
   */
  private calculateCrop(targetWidth: number, targetHeight: number): CropSettings {
    const sourceSize = 2048; // Square source
    const targetAspect = targetWidth / targetHeight;

    if (targetAspect > 1) {
      // Horizontal (16:9) - crop top and bottom
      const cropHeight = sourceSize / targetAspect;
      return {
        width: sourceSize,
        height: Math.round(cropHeight),
        x: 0,
        y: Math.round((sourceSize - cropHeight) / 2),
      };
    } else if (targetAspect < 1) {
      // Vertical (9:16) - crop left and right
      const cropWidth = sourceSize * targetAspect;
      return {
        width: Math.round(cropWidth),
        height: sourceSize,
        x: Math.round((sourceSize - cropWidth) / 2),
        y: 0,
      };
    } else {
      // Square (1:1) - no crop needed
      return {
        width: sourceSize,
        height: sourceSize,
        x: 0,
        y: 0,
      };
    }
  }

  /**
   * Calculate crop settings for any source dimensions to target aspect ratio
   */
  private calculateCropForSource(
    sourceWidth: number, 
    sourceHeight: number, 
    targetWidth: number, 
    targetHeight: number
  ): CropSettings {
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = targetWidth / targetHeight;

    if (targetAspect > sourceAspect) {
      // Target is wider than source - crop top and bottom
      const cropHeight = sourceWidth / targetAspect;
      return {
        width: sourceWidth,
        height: Math.round(cropHeight),
        x: 0,
        y: Math.round((sourceHeight - cropHeight) / 2),
      };
    } else if (targetAspect < sourceAspect) {
      // Target is taller than source - crop left and right
      const cropWidth = sourceHeight * targetAspect;
      return {
        width: Math.round(cropWidth),
        height: sourceHeight,
        x: Math.round((sourceWidth - cropWidth) / 2),
        y: 0,
      };
    } else {
      // Same aspect ratio - no crop needed
      return {
        width: sourceWidth,
        height: sourceHeight,
        x: 0,
        y: 0,
      };
    }
  }

  /**
   * Calculate logo position based on placement option and video dimensions
   */
  private calculateLogoPosition(
    position: LogoPosition,
    logoSize: { width: number; height: number },
    videoSize: { width: number; height: number },
    padding: number = 20
  ): { x: number; y: number } {
    const { width: lw, height: lh } = logoSize;
    const { width: vw, height: vh } = videoSize;

    switch (position) {
      case 'top-left':
        return { x: padding, y: padding };
      
      case 'top-right':
        return { x: vw - lw - padding, y: padding };
      
      case 'bottom-left':
        return { x: padding, y: vh - lh - padding };
      
      case 'bottom-right':
        return { x: vw - lw - padding, y: vh - lh - padding };
      
      case 'center':
        return { x: Math.round((vw - lw) / 2), y: Math.round((vh - lh) / 2) };
      
      default:
        return { x: padding, y: padding };
    }
  }

  /**
   * Generate a preview frame from video at specific timestamp
   */
  async generateThumbnail(
    videoPath: string, 
    outputPath: string, 
    timestamp: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '640x360'
        })
        .on('error', reject)
        .on('end', () => resolve());
    });
  }

  /**
   * Get video metadata
   */
  async getVideoInfo(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }
}