import { prisma } from '@/lib/prisma';
import { BulkVideo, Project, BulkVideoScene } from '@prisma/client';
import { BulkFFmpegRenderer } from './bulk-ffmpeg-renderer';
import { s3Utils } from '@/lib/s3-utils';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { 
  LogoPosition, 
  LogoOverlayConfig, 
  CropSettings, 
  FormatRenderConfig 
} from '@/app/types/bulk-video';

export class MultiFormatRenderer {
  private ffmpeg: BulkFFmpegRenderer;

  constructor() {
    this.ffmpeg = new BulkFFmpegRenderer();
  }

  async renderBulkVideo(bulkVideoId: string, mode: "missing" | "all" = "all"): Promise<void> {
    const bulkVideo = await prisma.bulkVideo.findUnique({
      where: { id: bulkVideoId },
      include: {
        project: true,
        scenes: {
          orderBy: { order: 'asc' },
        },
        renderedVideos: true,
      },
    });

    if (!bulkVideo || !bulkVideo.project) {
      throw new Error('Bulk video not found');
    }

    // Check if all scenes have animations
    const allScenesReady = bulkVideo.scenes.every(s => s.animationUrl && s.status === 'completed');
    if (!allScenesReady) {
      throw new Error('Not all scenes are ready for rendering');
    }

    // Determine formats to render
    const formats = bulkVideo.customFormats.length > 0 
      ? bulkVideo.customFormats 
      : bulkVideo.project.defaultFormats;

    if (formats.length === 0) {
      throw new Error('No formats specified for rendering');
    }

    // Prepare logo config
    const logoConfig: LogoOverlayConfig = {
      logoUrl: bulkVideo.project.brandLogoUrl!,
      position: bulkVideo.project.logoPosition as LogoPosition,
      size: {
        width: bulkVideo.project.logoWidth!,
        height: bulkVideo.project.logoHeight!,
      },
      padding: 20,
    };

    // Create temporary directory for this video
    const tempDir = path.join(process.cwd(), 'tmp', `bulk-video-${bulkVideoId}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // First, create the master square video from all scenes
      const masterVideoPath = await this.createMasterVideo(bulkVideo.scenes, tempDir);

      // Render each format
      for (const format of formats) {
        try {
          // Check if we should skip this format
          if (mode === "missing") {
            console.log(`[MultiFormatRenderer] Checking existing renders for format ${format}`);
            
            // Query database directly for the most up-to-date status
            const existingRender = await prisma.renderedVideo.findFirst({
              where: {
                bulkVideoId: bulkVideo.id,
                format: format,
                status: 'completed',
                url: { not: null }
              }
            });
            
            if (existingRender) {
              console.log(`[MultiFormatRenderer] Skipping format ${format} - already rendered`);
              continue;
            } else {
              console.log(`[MultiFormatRenderer] Will render format ${format} - no existing render found`);
            }
          }

          await this.renderFormat(bulkVideo, masterVideoPath, format, logoConfig, tempDir);
        } catch (error) {
          console.error(`Failed to render format ${format}:`, error);
          
          // Update or create rendered video record with failed status
          const existingRender = bulkVideo.renderedVideos.find(r => r.format === format);
          if (existingRender) {
            await prisma.renderedVideo.update({
              where: { id: existingRender.id },
              data: {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            });
          } else {
            await prisma.renderedVideo.create({
              data: {
                bulkVideoId,
                format,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            });
          }
        }
      }
    } finally {
      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async createMasterVideo(scenes: BulkVideoScene[], tempDir: string): Promise<string> {
    const masterPath = path.join(tempDir, 'master.mp4');
    
    // Download all scene animations to local files
    const sceneFiles: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.animationUrl) {
        throw new Error(`Scene ${i + 1} has no animation URL`);
      }
      
      const scenePath = path.join(tempDir, `scene_${i}.mp4`);
      await this.downloadFile(scene.animationUrl, scenePath);
      sceneFiles.push(scenePath);
    }
    
    // Concatenate all scene animations
    await this.ffmpeg.concatenateVideos(sceneFiles, masterPath);
    
    return masterPath;
  }

  private async renderFormat(
    bulkVideo: BulkVideo & { project: Project; renderedVideos: any[] },
    masterVideoPath: string,
    format: string,
    logoConfig: LogoOverlayConfig,
    tempDir: string
  ): Promise<void> {
    // First check if a rendered video record exists in the database
    let renderedVideo = await prisma.renderedVideo.findFirst({
      where: {
        bulkVideoId: bulkVideo.id,
        format: format
      }
    });
    
    if (!renderedVideo) {
      renderedVideo = await prisma.renderedVideo.create({
        data: {
          bulkVideoId: bulkVideo.id,
          format,
          status: 'rendering',
        },
      });
    } else {
      renderedVideo = await prisma.renderedVideo.update({
        where: { id: renderedVideo.id },
        data: { status: 'rendering' },
      });
    }

    try {
      // Download logo to temp directory
      const logoPath = path.join(tempDir, 'logo.png');
      await this.downloadFile(logoConfig.logoUrl, logoPath);

      // Use the bulk FFmpeg renderer
      const results = await this.ffmpeg.renderMultipleFormats({
        masterVideo: masterVideoPath,
        outputDir: tempDir,
        formats: [format],
        logo: {
          path: logoPath,
          position: logoConfig.position,
          width: logoConfig.size.width,
          height: logoConfig.size.height,
          padding: logoConfig.padding,
        },
      });

      const result = results[0];
      if (!result.success) {
        throw new Error(result.error || 'Failed to render format');
      }

      // Upload to S3
      const outputFilename = `${bulkVideo.id}-${format.replace('x', '-')}-${uuidv4()}.mp4`;
      const s3Key = `bulk-videos/${bulkVideo.projectId}/${outputFilename}`;
      await s3Utils.uploadToS3(s3Utils.buckets.videos, s3Key, result.outputPath);
      const uploadUrl = `${s3Utils.s3VideoUrl}/${s3Key}`;

      // Update rendered video record
      await prisma.renderedVideo.update({
        where: { id: renderedVideo.id },
        data: {
          url: uploadUrl,
          status: 'completed',
        },
      });
    } catch (error) {
      await prisma.renderedVideo.update({
        where: { id: renderedVideo.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private calculateCrop(targetWidth: number, targetHeight: number): CropSettings {
    const sourceSize = 2048; // Square source
    const targetAspect = targetWidth / targetHeight;

    if (targetAspect > 1) {
      // Horizontal - crop top and bottom
      const cropHeight = sourceSize / targetAspect;
      return {
        width: sourceSize,
        height: Math.round(cropHeight),
        x: 0,
        y: Math.round((sourceSize - cropHeight) / 2),
      };
    } else if (targetAspect < 1) {
      // Vertical - crop left and right
      const cropWidth = sourceSize * targetAspect;
      return {
        width: Math.round(cropWidth),
        height: sourceSize,
        x: Math.round((sourceSize - cropWidth) / 2),
        y: 0,
      };
    } else {
      // Square - no crop
      return {
        width: sourceSize,
        height: sourceSize,
        x: 0,
        y: 0,
      };
    }
  }

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
        return { x: (vw - lw) / 2, y: (vh - lh) / 2 };
      
      default:
        return { x: padding, y: padding };
    }
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    let downloadUrl = url;
    
    // Check if this is an S3 URL that needs a presigned URL
    if (url.includes('wasabisys.com') || url.includes('amazonaws.com') || url.includes('s3.')) {
      try {
        const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(url);
        downloadUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
      } catch (error) {
        console.warn('Failed to generate presigned URL, using original:', error);
      }
    }
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(buffer));
  }

  async renderSingleFormat(
    bulkVideoId: string,
    format: string
  ): Promise<string> {
    const bulkVideo = await prisma.bulkVideo.findUnique({
      where: { id: bulkVideoId },
      include: {
        project: true,
        scenes: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!bulkVideo || !bulkVideo.project) {
      throw new Error('Bulk video not found');
    }

    const tempDir = path.join(process.cwd(), 'tmp', `bulk-video-single-${uuidv4()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const masterVideoPath = await this.createMasterVideo(bulkVideo.scenes, tempDir);
      
      const logoConfig: LogoOverlayConfig = {
        logoUrl: bulkVideo.project.brandLogoUrl!,
        position: bulkVideo.project.logoPosition as LogoPosition,
        size: {
          width: bulkVideo.project.logoWidth!,
          height: bulkVideo.project.logoHeight!,
        },
        padding: 20,
      };

      // Check if we need to include renderedVideos
      const bulkVideoWithRendered = await prisma.bulkVideo.findUnique({
        where: { id: bulkVideoId },
        include: {
          project: true,
          scenes: {
            orderBy: { order: 'asc' },
          },
          renderedVideos: true,
        },
      });

      if (!bulkVideoWithRendered) {
        throw new Error('Bulk video not found');
      }

      await this.renderFormat(bulkVideoWithRendered, masterVideoPath, format, logoConfig, tempDir);

      const renderedVideo = await prisma.renderedVideo.findFirst({
        where: {
          bulkVideoId,
          format,
          status: 'completed',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!renderedVideo || !renderedVideo.url) {
        throw new Error('Failed to render video');
      }

      return renderedVideo.url;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}