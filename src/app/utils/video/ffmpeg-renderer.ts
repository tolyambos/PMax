import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { execSync } from "child_process";
import { FrameListEntry, VideoDimensions, VideoQualitySettings } from "./types";
import { s3Utils } from "@/lib/s3-utils";

// Configure FFmpeg path to use the system installation if available
function configureFFmpegPaths() {
  try {
    // Try to find FFmpeg and FFprobe paths using 'which' command on Unix systems
    // or 'where' command on Windows
    const isWindows = process.platform === "win32";
    const findCmd = isWindows ? "where" : "which";

    try {
      const ffmpegPath = execSync(`${findCmd} ffmpeg`).toString().trim();
      if (ffmpegPath) {
        console.log(`Using FFmpeg found at: ${ffmpegPath}`);
        ffmpeg.setFfmpegPath(ffmpegPath);
      }
    } catch (e) {
      console.warn("Could not find ffmpeg in PATH, using default");
    }

    try {
      const ffprobePath = execSync(`${findCmd} ffprobe`).toString().trim();
      if (ffprobePath) {
        console.log(`Using FFprobe found at: ${ffprobePath}`);
        ffmpeg.setFfprobePath(ffprobePath);
      }
    } catch (e) {
      console.warn("Could not find ffprobe in PATH, using default");
    }

    // Rotation support has been removed as requested
    console.log("FFmpeg rotation support: Disabled (removed as requested)");
  } catch (e) {
    console.error("Error configuring FFmpeg paths:", e);
  }
}

// Run configuration on module load
configureFFmpegPaths();

/**
 * Handles video rendering with ffmpeg
 */
export class FFmpegRenderer {
  private tempFiles: string[] = [];
  private imageOverlays: any[] = [];

  // Rotation support removed as requested by user
  constructor() {
    this.logFFmpegConfig();
  }

  // Log FFmpeg configuration
  private logFFmpegConfig(): void {
    try {
      // Get ffmpeg path
      const ffmpegPath = execSync("which ffmpeg").toString().trim();
      console.log(`Using FFmpeg from: ${ffmpegPath}`);

      // Get ffmpeg version and features
      const versionInfo = execSync("ffmpeg -version").toString().trim();
      const firstLine = versionInfo.split("\n")[0];
      console.log(`FFmpeg version: ${firstLine}`);

      // Rotation support has been removed as requested
      console.log("Rotation support: Disabled (removed as requested)");
    } catch (error) {
      console.error("Error detecting FFmpeg configuration:", error);
    }
  }

  /**
   * Create a frame list file for ffmpeg - FIXED to not duplicate last frame
   */
  private async createFrameListFile(
    frameList: FrameListEntry[],
    outputPath: string
  ): Promise<void> {
    let content = "# FFmpeg concat format\n";

    // Debug logging for frame list entries
    console.log(`Creating frame list file with ${frameList.length} entries:`);

    frameList.forEach((entry, index) => {
      // Ensure duration is properly handled and non-zero
      const duration =
        typeof entry.duration === "number"
          ? Math.max(0.1, entry.duration) // Ensure min 0.1s duration
          : Math.max(0.1, parseFloat(String(entry.duration)) || 3);

      // Use single quotes around filepaths and escape single quotes within filepaths
      const escapedPath = entry.filePath.replace(/'/g, "'\\''");

      // Log each entry for debugging
      console.log(
        `[FFMPEG-RENDERER] Entry ${index}: file='${escapedPath}', duration=${duration}s (original: ${entry.duration}, type: ${typeof entry.duration})`
      );

      content += `file '${escapedPath}'\nduration ${duration}\n`;
    });

    // REMOVED: The duplicate last file entry was causing incorrect video duration
    // For static images with explicit durations, no duplicate entry is needed

    // Write the file
    await fs.promises.writeFile(outputPath, content);
    console.log(
      `Created frame list at ${outputPath} with ${frameList.length} entries`
    );

    // Validate the frame list file by reading it back
    const fileContent = await fs.promises.readFile(outputPath, "utf8");
    console.log("=== COMPLETE FRAME LIST FILE CONTENT ===");
    console.log(fileContent);
    console.log("=== END FRAME LIST FILE CONTENT ===");

    // Count entries to verify
    const fileEntries = fileContent
      .split("\n")
      .filter((line) => line.trim().startsWith("file ")).length;
    const durationEntries = fileContent
      .split("\n")
      .filter((line) => line.trim().startsWith("duration ")).length;

    console.log(
      `Verified frame list: ${fileEntries} file entries (should be ${frameList.length}), ${durationEntries} duration entries (should be ${frameList.length})`
    );
  }

  /**
   * Primary rendering method using duration control - with HIGH QUALITY settings
   */
  private renderWithDurationControl(
    frameListPath: string,
    outputPath: string,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      console.log("Rendering video with duration control method");

      // Validate the frame list file exists
      if (!fs.existsSync(frameListPath)) {
        console.error(
          `⚠️ ERROR: Frame list file not found at: ${frameListPath}`
        );
        reject(new Error(`Frame list file not found at: ${frameListPath}`));
        return;
      }

      // Log the start of FFmpeg rendering
      console.log("Starting FFmpeg processing with parameters:", {
        inputListPath: frameListPath,
        outputPath,
        dimensions: `${dimensions.width}x${dimensions.height}`,
        fps: qualitySettings.fps,
        bitrate: qualitySettings.bitrate,
      });

      ffmpeg()
        .input(frameListPath)
        .inputOptions([
          "-f concat",
          "-safe 0",
          "-protocol_whitelist file,http,https,tcp,tls",
        ])
        .outputOptions([
          ...this.getHighQualityOutputOptions(qualitySettings.fps),
          `-vf scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
          `-color_primaries`,
          `bt709`, // Ensure consistent color space
          `-color_trc`,
          `bt709`, // Ensure consistent transfer characteristics
          `-colorspace`,
          `bt709`, // Ensure consistent color space
          `-metadata:s:v:0 language=eng`,
          `-strict experimental`,
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg duration control process started:", commandLine);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${progress.percent.toFixed(1)}% done`);
          }
        })
        .on("error", (err) => {
          console.error("Error during FFmpeg processing:", err);
          reject(err);
        })
        .on("end", () => {
          console.log("FFmpeg processing complete");

          // Verify the rendered video with FFprobe
          this.verifyRenderedVideo(outputPath)
            .then(() => resolve(outputPath))
            .catch((verifyError) => {
              console.warn("Video verification failed:", verifyError);
              resolve(outputPath); // Still resolve since FFmpeg completed
            });
        })
        .run();
    });
  }

  /**
   * Alternative rendering method using complex filter - FIXED VERSION
   */
  private renderWithComplexFilter(
    frameList: FrameListEntry[],
    outputPath: string,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      console.log("Rendering video with complex filter method");
      console.log(
        `Using ${frameList.length} frames with complex filter method`
      );

      if (frameList.length === 0) {
        reject(new Error("No frames provided for complex filter rendering"));
        return;
      }

      try {
        const command = ffmpeg();

        // Add each input with proper options for images vs videos
        frameList.forEach((entry, index) => {
          console.log(
            `Adding input ${index}: ${entry.filePath} (duration: ${entry.duration}s)`
          );

          if (
            entry.filePath.endsWith(".mp4") ||
            entry.filePath.endsWith(".mov") ||
            entry.filePath.endsWith(".avi")
          ) {
            // Video input - trim to specified duration
            command
              .input(entry.filePath)
              .inputOptions([`-t`, `${entry.duration}`]);
          } else {
            // Image input - loop for duration
            command
              .input(entry.filePath)
              .inputOptions([`-loop`, `1`, `-t`, `${entry.duration}`]);
          }
        });

        // Build complex filter string with proper syntax and timing
        let filterParts: string[] = [];
        let streamLabels: string[] = [];

        // Scale, pad, and normalize timing for each input
        for (let i = 0; i < frameList.length; i++) {
          const isImage = !frameList[i].filePath.match(/\.(mp4|mov|avi)$/i);
          const streamLabel = `v${i}`;
          streamLabels.push(streamLabel);

          if (isImage) {
            // For images: set fps first, then scale
            filterParts.push(
              `[${i}:v]fps=${qualitySettings.fps},scale=${dimensions.width}:${dimensions.height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setsar=1[${streamLabel}]`
            );
          } else {
            // For videos: scale first, then set fps, ensure proper SAR
            filterParts.push(
              `[${i}:v]scale=${dimensions.width}:${dimensions.height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2:black,fps=${qualitySettings.fps},format=yuv420p,setsar=1[${streamLabel}]`
            );
          }
        }

        // Add image overlays
        if (this.imageOverlays && this.imageOverlays.length > 0) {
          this.imageOverlays.forEach((overlay, index) => {
            const overlayStreamLabel = `overlay_${index}`;
            streamLabels.push(overlayStreamLabel);

            filterParts.push(
              `[${index}:v]overlay=x=${overlay.x}:y=${overlay.y}:format=yuv420p,format=yuv420p[${overlayStreamLabel}]`
            );
          });
        }

        // Join all the filter parts
        let complexFilter = filterParts.join(";");

        // Add the concat part
        const concatInputs = streamLabels.map((label) => `[${label}]`).join("");
        complexFilter += `;${concatInputs}concat=n=${frameList.length}:v=1:a=0[out]`;

        console.log("Generated complex filter:", complexFilter);

        command
          .complexFilter(complexFilter)
          .outputOptions([
            `-map`,
            `[out]`,
            ...this.getHighQualityOutputOptions(qualitySettings.fps),
            `-metadata:s:v:0`,
            `language=eng`,
            `-strict`,
            `experimental`,
          ])
          .output(outputPath)
          .on("start", (commandLine) => {
            console.log("FFmpeg complex filter process started");
            console.log("Full command:", commandLine);
          })
          .on("progress", (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${progress.percent.toFixed(1)}% done`);
            }
          })
          .on("stderr", (stderrLine) => {
            // Log stderr for debugging
            if (stderrLine.includes("error") || stderrLine.includes("Error")) {
              console.error("FFmpeg stderr:", stderrLine);
            }
          })
          .on("error", (err, _stdout, stderr) => {
            console.error(
              "Error during FFmpeg complex filter processing:",
              err
            );
            console.error("FFmpeg stderr:", stderr);
            reject(err);
          })
          .on("end", () => {
            console.log("FFmpeg complex filter processing complete");

            // Verify the rendered video with FFprobe
            this.verifyRenderedVideo(outputPath)
              .then(() => resolve(outputPath))
              .catch((verifyError) => {
                console.warn("Video verification failed:", verifyError);
                resolve(outputPath); // Still resolve since FFmpeg completed
              });
          })
          .run();
      } catch (setupError) {
        console.error("Error setting up FFmpeg command:", setupError);
        reject(setupError);
      }
    });
  }

  /**
   * Process special markers in filter commands including image overlays
   * This converts markers to proper FFmpeg filter chains with S3 URL refresh
   */
  private async processFilterMarkers(
    filterCommands: string[]
  ): Promise<string[]> {
    const processedCommands: string[] = [];
    const simpleFilters: string[] = [];

    console.log(
      `[processFilterMarkers] Processing ${filterCommands.length} filter commands`
    );

    // Process each filter command
    for (const command of filterCommands) {
      // Skip empty commands
      if (!command || command.trim() === "") {
        continue;
      }

      // Check if this is an image overlay marker
      if (command.startsWith("##IMAGE_OVERLAY:")) {
        console.log(
          `[processFilterMarkers] Processing image overlay: ${command}`
        );

        // Parse the image overlay parameters
        const params = command
          .replace("##IMAGE_OVERLAY:", "")
          .replace("##", "")
          .split(":");

        if (params.length < 7) {
          console.error(
            `[processFilterMarkers] Invalid image overlay format: ${command}`
          );
          continue;
        }

        const [elementId, x, y, width, height, , opacity] = params;

        // Get the element to find its URL
        const imageUrl = await this.getElementImageUrl(elementId);
        console.log(`[processFilterMarkers] getElementImageUrl result for ${elementId}:`, imageUrl);

        if (imageUrl) {
          try {
            // Refresh the S3 URL to ensure it's not expired
            const refreshedUrl = await s3Utils.refreshS3Url(imageUrl);
            console.log(
              `[processFilterMarkers] Refreshed image URL for element ${elementId}: ${refreshedUrl}`
            );

            // Download the image to a temporary local file for FFmpeg overlay
            const numX = parseFloat(x);
            const numY = parseFloat(y);
            const numWidth = parseFloat(width);
            const numHeight = parseFloat(height);
            const numOpacity = parseFloat(opacity) || 1;

            // Create a temporary file path for the downloaded image
            const tempImagePath = `/tmp/overlay_${elementId}_${Date.now()}.png`;

            try {
              // Download the image with timeout and better error handling
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

              const response = await fetch(refreshedUrl, {
                signal: controller.signal,
                headers: {
                  "User-Agent": "PMax-Video-Renderer/1.0",
                },
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                console.error(
                  `[processFilterMarkers] HTTP ${response.status} ${response.statusText} for URL: ${refreshedUrl}`
                );

                // If we get a 403, try refreshing the URL one more time
                if (response.status === 403) {
                  console.log(
                    `[processFilterMarkers] Got 403, attempting to refresh URL again for element ${elementId}`
                  );
                  try {
                    const retryUrl = await s3Utils.refreshS3Url(imageUrl);
                    if (retryUrl !== refreshedUrl) {
                      // Create a new controller for the retry attempt
                      const retryController = new AbortController();
                      const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
                      
                      const retryResponse = await fetch(retryUrl, {
                        signal: retryController.signal,
                        headers: {
                          "User-Agent": "PMax-Video-Renderer/1.0",
                        },
                      });
                      
                      clearTimeout(retryTimeoutId);
                      if (retryResponse.ok) {
                        console.log(
                          `[processFilterMarkers] Retry successful for element ${elementId}`
                        );
                        const retryBuffer = await retryResponse.arrayBuffer();
                        const fs = require("fs");
                        fs.writeFileSync(
                          tempImagePath,
                          Buffer.from(retryBuffer)
                        );
                      } else {
                        throw new Error(
                          `Retry also failed: ${retryResponse.status} ${retryResponse.statusText}`
                        );
                      }
                    } else {
                      throw new Error(
                        `URL refresh didn't generate new URL: ${response.status} ${response.statusText}`
                      );
                    }
                  } catch (retryError) {
                    console.error(
                      `[processFilterMarkers] Retry failed for element ${elementId}:`,
                      retryError
                    );
                    throw new Error(
                      `Failed to download image after retry: ${response.status} ${response.statusText}`
                    );
                  }
                } else {
                  throw new Error(
                    `Failed to download image: ${response.status} ${response.statusText}`
                  );
                }
              } else {
                const buffer = await response.arrayBuffer();
                const fs = require("fs");
                fs.writeFileSync(tempImagePath, Buffer.from(buffer));
              }

              // Store overlay info for complex filter processing
              this.imageOverlays = this.imageOverlays || [];
              this.imageOverlays.push({
                elementId,
                imagePath: tempImagePath,
                x: numX,
                y: numY,
                width: numWidth,
                height: numHeight,
                opacity: numOpacity,
              });

              console.log(
                `[processFilterMarkers] Downloaded and queued image overlay for element ${elementId}: ${tempImagePath}`
              );

              // Store the temp file path for cleanup later
              this.tempFiles = this.tempFiles || [];
              this.tempFiles.push(tempImagePath);

              // Don't add to simpleFilters - will be handled in complex filter
            } catch (downloadError) {
              console.error(
                `[processFilterMarkers] Failed to download image for element ${elementId}:`,
                downloadError
              );
              // Fallback to red placeholder (download failed)
              simpleFilters.push(
                `drawbox=x=${numX}:y=${numY}:w=${numWidth}:h=${numHeight}:color=red@0.7:t=fill`
              );
            }
          } catch (error: unknown) {
            console.error(
              `[processFilterMarkers] Error processing image overlay for element ${elementId}:`,
              error instanceof Error ? error.message : "Unknown error"
            );
            // Add error placeholder as fallback
            const numX = parseFloat(x);
            const numY = parseFloat(y);
            const numWidth = parseFloat(width);
            const numHeight = parseFloat(height);
            simpleFilters.push(
              `drawbox=x=${numX}:y=${numY}:w=${numWidth}:h=${numHeight}:color=red@0.3:t=fill`
            );
          }
        } else {
          console.warn(
            `[processFilterMarkers] No image URL found for element ${elementId}`
          );
          // Add missing image placeholder
          simpleFilters.push(
            `drawbox=x=${parseFloat(x)}:y=${parseFloat(y)}:w=${parseFloat(width)}:h=${parseFloat(height)}:color=gray@0.5:t=fill`
          );
        }
      } else if (!command.startsWith("##ROTATED_")) {
        // For all other commands (non-image overlays and non-rotation markers), add them to simple filters
        // Note: Rotation markers are no longer processed as requested by user
        simpleFilters.push(command);
      }
    }

    // Return all simple filters (no complex filter chains needed without rotation)
    processedCommands.push(...simpleFilters);
    return processedCommands;
  }

  /**
   * Get the image URL for an element by looking it up from the database
   */
  private async getElementImageUrl(elementId: string): Promise<string | null> {
    console.log(
      `[getElementImageUrl] Looking up image URL for element ${elementId}`
    );

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import("@/lib/prisma");

      // Find the element in the database
      const element = await prisma.element.findUnique({
        where: { id: elementId },
        include: {
          asset: true, // Include the asset to get the URL
        },
      });

      if (!element) {
        console.log(
          `[getElementImageUrl] Element ${elementId} not found in database`
        );
        return null;
      }

      // Debug log the full element data
      console.log(`[getElementImageUrl] Element ${elementId} data:`, {
        id: element.id,
        type: element.type,
        url: element.url,
        content: element.content,
        hasAsset: !!element.asset,
        assetUrl: element.asset?.url
      });

      // Check if element has a direct URL field (new pattern)
      if (element.url) {
        console.log(
          `[getElementImageUrl] Found direct URL for element ${elementId}: ${element.url}`
        );
        return element.url;
      }

      // Check if element has an associated asset
      if (element.asset && element.asset.url) {
        console.log(
          `[getElementImageUrl] Found asset URL for element ${elementId}: ${element.asset.url}`
        );
        return element.asset.url;
      }

      // Try to parse content to find URL (old pattern for ImageElementEditor)
      if (element.content) {
        try {
          const content =
            typeof element.content === "string"
              ? JSON.parse(element.content)
              : element.content;

          if (content && typeof content === "object") {
            // Check for both content.url and content.src patterns
            const url = content.url || content.src;
            if (url) {
              console.log(
                `[getElementImageUrl] Found URL in content for element ${elementId}: ${url}`
              );
              return url;
            }
          }
        } catch (parseError) {
          console.warn(
            `[getElementImageUrl] Could not parse content for element ${elementId}:`,
            parseError
          );
        }
      }

      console.log(`[getElementImageUrl] No URL found for element ${elementId}`);
      return null;
    } catch (error) {
      console.error(
        `[getElementImageUrl] Error looking up element ${elementId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Clear image overlays for the next scene
   */
  private clearImageOverlays(): void {
    this.imageOverlays = [];
  }

  /**
   * Apply filters to a video
   */
  public async applyFiltersToVideo(
    inputPath: string,
    outputPath: string,
    filters: string[],
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<string> {
    // Clear any previous image overlays
    this.clearImageOverlays();

    if (!filters || filters.length === 0) {
      // No filters to apply, just copy the file
      fs.copyFileSync(inputPath, outputPath);
      return Promise.resolve(outputPath);
    }

    console.log(`Applying ${filters.length} filters to video: ${inputPath}`);

    // Process any special markers including image overlays with S3 refresh
    return this.processFilterMarkers(filters).then((processedFilters) => {
      return new Promise<string>((resolve, reject) => {
        // Use traditional approach for simple filters (rotation removed as requested)
        const filterString = processedFilters.join(",");
        this.applySimpleVideoFilters(
          inputPath,
          outputPath,
          dimensions,
          qualitySettings,
          filterString,
          resolve,
          reject
        );
      });
    });
  }

  public async applyFiltersToImage(
    inputPath: string,
    outputPath: string,
    filters: string[]
  ): Promise<string> {
    // Clear any previous image overlays
    this.clearImageOverlays();

    if (!filters || filters.length === 0) {
      // No filters to apply, just copy the file
      fs.copyFileSync(inputPath, outputPath);
      return Promise.resolve(outputPath);
    }

    console.log(`Applying ${filters.length} filters to image: ${inputPath}`);

    // Process any special markers including image overlays with S3 refresh
    return this.processFilterMarkers(filters).then((processedFilters) => {
      return new Promise<string>((resolve, reject) => {
        const filterString = processedFilters.join(",");

        const command = ffmpeg().input(inputPath);

        // Add image overlays if any
        if (this.imageOverlays && this.imageOverlays.length > 0) {
          this.imageOverlays.forEach((overlay) => {
            command.input(overlay.imagePath);
          });

          // Build complex filter for image overlays
          let complexFilter = `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`;
          if (filterString && filterString.trim()) {
            complexFilter += `,${filterString}`;
          }
          complexFilter += `[base]`;

          let currentInput = "[base]";
          this.imageOverlays.forEach((overlay, index) => {
            const imageInput = index + 1;
            const outputLabel =
              index === this.imageOverlays.length - 1 ? "" : `[out${index}]`;
            complexFilter += `;[${imageInput}:v]scale=${overlay.width}:${overlay.height}[img${index}]`;
            complexFilter += `;${currentInput}[img${index}]overlay=${overlay.x}:${overlay.y}${outputLabel}`;
            currentInput = `[out${index}]`;
          });

          command.complexFilter(complexFilter);
        } else {
          // Simple filter string for image processing
          const imageFilterString = `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,${filterString}`;
          command.videoFilters(imageFilterString);
        }

        command
          .output(outputPath)
          .outputOptions([
            "-vframes",
            "1", // Only output 1 frame for images
            "-q:v",
            "2", // High quality
            "-y", // Overwrite output file
          ])
          .on("end", () => {
            console.log(`Image filters applied successfully: ${outputPath}`);
            this.clearImageOverlays(); // Clean up overlays
            resolve(outputPath);
          })
          .on("error", (err) => {
            console.error(`Error applying filters to image:`, err);
            this.clearImageOverlays(); // Clean up overlays on error
            reject(err);
          })
          .run();
      });
    });
  }

  /**
   * Helper method for applying simple filters to video
   */
  private applySimpleVideoFilters(
    inputPath: string,
    outputPath: string,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings,
    filterString: string,
    resolve: (value: string) => void,
    reject: (reason: any) => void
  ): void {
    // Create FFmpeg command
    const command = ffmpeg().input(inputPath); // Main video input

    // Check if we have image overlays - if so, use complex filter
    if (this.imageOverlays && this.imageOverlays.length > 0) {
      console.log(
        `[applySimpleVideoFilters] Using complex filter with ${this.imageOverlays.length} image overlays`
      );

      // Add image inputs
      this.imageOverlays.forEach((overlay) => {
        command.input(overlay.imagePath);
      });

      // Build complex filter string
      let complexFilter = `[0:v]scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2`;

      // Add basic filters if any (properly integrate drawtext and other filters into the chain)
      if (filterString && filterString.trim()) {
        complexFilter += `,${filterString}`;
      }

      // Create labeled output after applying text/shape filters
      complexFilter += `[base]`;

      // Add image overlay filters
      let currentInput = "[base]";

      this.imageOverlays.forEach((overlay, index) => {
        const imageInput = index + 1; // Input 0 is video, images start at 1
        const isLast = index === this.imageOverlays.length - 1;
        const outputLabel = isLast ? "" : `[out${index}]`;
        
        // Scale the overlay image
        complexFilter += `;[${imageInput}:v]scale=${overlay.width}:${overlay.height}[img${index}]`;
        
        // Apply overlay
        complexFilter += `;${currentInput}[img${index}]overlay=${overlay.x}:${overlay.y}${outputLabel}`;
        
        if (!isLast) {
          currentInput = `[out${index}]`;
        }
      });

      console.log(`[applySimpleVideoFilters] Complex filter: ${complexFilter}`);

      command
        .complexFilter(complexFilter)
        .output(outputPath)
        .outputOptions([
          ...this.getHighQualityOutputOptions(qualitySettings.fps),
          "-metadata:s:v:0",
          "language=eng",
        ]);
    } else {
      // Use simple filters (original behavior)
      const resizeAndFilterString = `scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2,${filterString}`;

      command
        .output(outputPath)
        .outputOptions([
          ...this.getHighQualityOutputOptions(qualitySettings.fps),
          "-metadata:s:v:0",
          "language=eng",
        ])
        .videoFilters(resizeAndFilterString);
    }
    command
      .on("start", (commandLine) => {
        console.log("FFmpeg video filter process started:", commandLine);
      })
      .on("error", (err) => {
        console.error("Error applying filters to video:", err);

        // If filter fails, try to copy the original file as fallback
        try {
          console.log("Filter failed, copying original video as fallback");
          fs.copyFileSync(inputPath, outputPath);
          resolve(outputPath);
        } catch (copyErr) {
          reject(err); // If copy also fails, reject with original error
        }
      })
      .on("end", () => {
        console.log("FFmpeg video filter process complete");

        // Verify the rendered video with FFprobe
        this.verifyRenderedVideo(outputPath)
          .then(() => resolve(outputPath))
          .catch((verifyError) => {
            console.warn("Video verification failed:", verifyError);
            resolve(outputPath); // Still resolve since FFmpeg completed
          });
      })
      .run();
  }

  /**
   * Trim a video to a specified length
   * Fixed to avoid color/brightness artifacts at trim points
   */
  private async trimVideoToLength(
    inputPath: string,
    outputPath: string,
    duration: number,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .inputOptions([
          `-t`,
          `${duration}`,
          `-avoid_negative_ts`,
          `make_zero`, // Avoid timestamp issues
          `-fflags`,
          `+genpts`, // Generate proper timestamps
        ])
        .outputOptions([
          ...this.getHighQualityOutputOptions(qualitySettings.fps, duration),
          `-vf`,
          `scale=${dimensions.width}:${dimensions.height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
          `-color_primaries`,
          `bt709`, // Ensure consistent color space
          `-color_trc`,
          `bt709`, // Ensure consistent transfer characteristics
          `-colorspace`,
          `bt709`, // Ensure consistent color space
          `-avoid_negative_ts`,
          `make_zero`, // Consistent with input
          `-fps_mode`,
          `cfr`, // Constant frame rate mode
          `-vsync`,
          `cfr`, // Constant frame rate sync
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log(
            `Trimming video to ${duration}s with color consistency: ${commandLine}`
          );
        })
        .on("error", (err) => {
          console.error(`Error trimming video (${inputPath}):`, err);
          reject(err);
        })
        .on("end", () => {
          console.log(`Trimmed video to ${duration}s: ${outputPath}`);
          resolve();
        })
        .run();
    });
  }

  /**
   * Convert a single image to a video for concat compatibility
   * Updated with consistent color space settings
   */
  private convertImageToVideo(
    imagePath: string,
    outputPath: string,
    duration: number,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions([`-loop`, `1`, `-t`, `${duration}`])
        .outputOptions([
          ...this.getHighQualityOutputOptions(qualitySettings.fps, duration),
          `-vf`,
          `scale=${dimensions.width}:${dimensions.height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
          `-color_primaries`,
          `bt709`, // Match video color space
          `-color_trc`,
          `bt709`, // Match video transfer characteristics
          `-colorspace`,
          `bt709`, // Match video color space
          `-fps_mode`,
          `cfr`, // Constant frame rate mode
          `-vsync`,
          `cfr`, // Constant frame rate sync
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log(
            `Converting image to video with color consistency: ${commandLine}`
          );
        })
        .on("error", (err) => {
          console.error(`Error converting image to video (${imagePath}):`, err);
          reject(err);
        })
        .on("end", () => {
          console.log(`Converted image to video: ${outputPath}`);
          resolve();
        })
        .run();
    });
  }

  /**
   * Fallback method for mixed content rendering
   * Converts all images to temporary videos then uses concat demuxer
   */
  private async renderMixedContentFallback(
    frameList: FrameListEntry[],
    outputPath: string,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<string> {
    console.log("Using mixed content fallback rendering method");

    const tempDir = path.dirname(outputPath);
    const tempVideoFiles: string[] = [];

    try {
      // Convert all images to temporary videos
      const processedFrames: FrameListEntry[] = [];

      for (let i = 0; i < frameList.length; i++) {
        const entry = frameList[i];

        if (
          entry.filePath.endsWith(".mp4") ||
          entry.filePath.endsWith(".mov") ||
          entry.filePath.endsWith(".avi")
        ) {
          // Trim video files to specified duration
          const trimmedVideoPath = path.join(tempDir, `trimmed-video-${i}.mp4`);
          tempVideoFiles.push(trimmedVideoPath);

          await this.trimVideoToLength(
            entry.filePath,
            trimmedVideoPath,
            entry.duration,
            dimensions,
            qualitySettings
          );

          processedFrames.push({
            filePath: trimmedVideoPath,
            duration: entry.duration,
          });
        } else {
          // Convert image to temporary video
          const tempVideoPath = path.join(tempDir, `temp-video-${i}.mp4`);
          tempVideoFiles.push(tempVideoPath);

          await this.convertImageToVideo(
            entry.filePath,
            tempVideoPath,
            entry.duration,
            dimensions,
            qualitySettings
          );

          processedFrames.push({
            filePath: tempVideoPath,
            duration: entry.duration,
          });
        }
      }

      // Create frame list for homogeneous video content
      const frameListPath = path.join(tempDir, "fallback-framelist.txt");
      await this.createFrameListFile(processedFrames, frameListPath);

      // Use concat demuxer method with all videos
      const result = await this.renderWithDurationControl(
        frameListPath,
        outputPath,
        dimensions,
        qualitySettings
      );

      return result;
    } finally {
      // Cleanup temporary files
      for (const tempFile of tempVideoFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            await fs.promises.unlink(tempFile);
            console.log(`Cleaned up temporary file: ${tempFile}`);
          }
        } catch (cleanupError) {
          console.warn(
            `Failed to cleanup temporary file ${tempFile}:`,
            cleanupError
          );
        }
      }
    }
  }

  /**
   * Create a simple slideshow from images as fallback
   */
  public async createSimpleSlideshow(
    imagePaths: string[],
    outputPath: string,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!imagePaths || imagePaths.length === 0) {
        reject(new Error("No images provided for slideshow"));
        return;
      }

      console.log(`Creating simple slideshow with ${imagePaths.length} images`);

      // Calculate default duration for each image
      const frameDuration = 3; // Default 3 seconds per image

      ffmpeg()
        .input(
          `pattern_type=glob:${path.dirname(imagePaths[0])}/*.{jpg,jpeg,png,webp}`
        )
        .inputOptions(["-pattern_type glob"])
        .outputOptions([
          `-c:v libx264`,
          `-preset slow`,
          `-crf 18`,
          `-r ${qualitySettings.fps}`,
          `-b:v ${qualitySettings.bitrate}`,
          `-pix_fmt yuv420p`,
          `-vf fps=${qualitySettings.fps},scale=${dimensions.width}:${dimensions.height},format=yuv420p`,
          `-framerate 1/${frameDuration}`, // One frame every 3 seconds
          `-movflags +faststart`,
          `-strict experimental`,
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg slideshow process started:", commandLine);
        })
        .on("progress", (progress) => {
          console.log(
            `Processing: ${progress.percent ? progress.percent.toFixed(1) : 0}% done`
          );
        })
        .on("error", (err) => {
          console.error("Error creating slideshow:", err);
          reject(err);
        })
        .on("end", () => {
          console.log("FFmpeg slideshow processing complete");

          // Verify the rendered video with FFprobe
          this.verifyRenderedVideo(outputPath)
            .then(() => resolve(outputPath))
            .catch((verifyError) => {
              console.warn("Video verification failed:", verifyError);
              resolve(outputPath); // Still resolve since FFmpeg completed
            });
        })
        .run();
    });
  }

  /**
   * Verify the rendered video with FFprobe
   */
  private async verifyRenderedVideo(outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(outputPath, (err, metadata) => {
        if (err) {
          console.error("FFprobe error:", err);
          reject(err);
          return;
        }

        const duration = metadata.format?.duration || 0;
        const size = metadata.format?.size || 0;
        const streams = metadata.streams || [];
        const videoStream = streams.find((s) => s.codec_type === "video");

        console.log("=== VIDEO VERIFICATION ===");
        console.log(`File: ${outputPath}`);
        console.log(`Duration: ${duration} seconds`);
        console.log(
          `File size: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`
        );
        console.log(`Video codec: ${videoStream?.codec_name}`);
        console.log(`Resolution: ${videoStream?.width}x${videoStream?.height}`);
        console.log(`Frame rate: ${videoStream?.r_frame_rate}`);
        console.log("=== END VIDEO VERIFICATION ===");

        resolve();
      });
    });
  }

  /**
   * Cleanup temporary files
   */
  public async cleanup(): Promise<void> {
    if (this.tempFiles && this.tempFiles.length > 0) {
      for (const tempFile of this.tempFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            await fs.promises.unlink(tempFile);
            console.log(`Cleaned up temporary file: ${tempFile}`);
          }
        } catch (cleanupError) {
          console.warn(
            `Failed to cleanup temporary file ${tempFile}:`,
            cleanupError
          );
        }
      }
      this.tempFiles = [];
    }
  }

  /**
   * Render a video from a list of frames with durations - with additional validation
   */
  public async renderVideo(
    frameList: FrameListEntry[],
    outputPath: string,
    dimensions: VideoDimensions,
    qualitySettings: VideoQualitySettings
  ): Promise<string> {
    try {
      console.log(
        `Starting video rendering: ${dimensions.width}x${dimensions.height} at ${qualitySettings.fps}fps, bitrate: ${qualitySettings.bitrate}`
      );
      console.log(`Frame list contains ${frameList.length} frames`);

      // VALIDATION: Make sure we have a valid frame list with proper durations
      if (!frameList || frameList.length === 0) {
        throw new Error("No frames provided for video rendering");
      }

      // Validate and normalize each frame entry
      const validatedFrameList = frameList.map((entry) => {
        // Ensure file exists
        if (!fs.existsSync(entry.filePath)) {
          console.error(`⚠️ WARNING: Frame file not found: ${entry.filePath}`);
        }

        // Ensure duration is valid
        const duration =
          typeof entry.duration === "number"
            ? Math.max(0.1, entry.duration) // Ensure min 0.1s duration
            : Math.max(0.1, parseFloat(String(entry.duration)) || 3);

        return {
          filePath: entry.filePath,
          duration,
        };
      });

      // Calculate total duration
      const totalDuration = validatedFrameList.reduce(
        (sum, entry) => sum + entry.duration,
        0
      );
      console.log(
        `Total video duration will be: ${totalDuration.toFixed(2)} seconds`
      );

      // Log each frame entry for debugging
      console.log("=== COMPLETE FRAME LIST DEBUG ===");
      validatedFrameList.forEach((entry, index) => {
        console.log(
          `Frame ${index + 1}: ${entry.filePath} (duration: ${entry.duration}s)`
        );
      });
      console.log("=== END FRAME LIST DEBUG ===");

      // Additional debug: show the frame list array structure
      console.log(
        "Frame list array structure:",
        JSON.stringify(
          validatedFrameList.map((entry, index) => ({
            index: index,
            fileName: path.basename(entry.filePath),
            duration: entry.duration,
            exists: fs.existsSync(entry.filePath),
          })),
          null,
          2
        )
      );

      // Create a temporary directory for the framelist file
      const tempDir = path.dirname(outputPath);
      const frameListPath = path.join(tempDir, "framelist.txt");

      // Create the frame list file with validated entries
      await this.createFrameListFile(validatedFrameList, frameListPath);

      // Check if we have mixed content (images + videos)
      const frameListContent = await fs.promises.readFile(
        frameListPath,
        "utf8"
      );
      const hasImages =
        frameListContent.includes(".jpg") ||
        frameListContent.includes(".jpeg") ||
        frameListContent.includes(".png") ||
        frameListContent.includes(".webp");
      const hasVideos =
        frameListContent.includes(".mp4") ||
        frameListContent.includes(".mov") ||
        frameListContent.includes(".avi");

      if (hasImages && hasVideos) {
        console.log(
          "🚨 Mixed content detected (images + videos). Using fallback rendering method."
        );
        console.log(
          "The concat demuxer cannot handle mixed content properly - converting all to videos first."
        );

        // Always use the fallback method for mixed content
        return await this.renderMixedContentFallback(
          validatedFrameList,
          outputPath,
          dimensions,
          qualitySettings
        );
      }

      // Try rendering with primary method first (only for homogeneous content)
      try {
        console.log(
          "Homogeneous content detected. Using concat demuxer method."
        );
        return await this.renderWithDurationControl(
          frameListPath,
          outputPath,
          dimensions,
          qualitySettings
        );
      } catch (error) {
        console.error("Error rendering with duration control method:", error);
        console.log("Falling back to alternative rendering method...");

        // Try alternative method
        return await this.renderWithComplexFilter(
          validatedFrameList,
          outputPath,
          dimensions,
          qualitySettings
        );
      }
    } catch (error: unknown) {
      console.error(
        "Error in renderVideo:",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw new Error(
        `Failed to render video: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate high-quality output options for FFmpeg
   * Optimized settings for better quality and performance
   */
  private getHighQualityOutputOptions(
    fps: number = 30,
    duration?: number
  ): string[] {
    const options = [
      "-r",
      fps.toString(),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-b:v",
      "6M",
      "-bufsize",
      "12M",
      "-maxrate",
      "8M",
      "-preset",
      "medium", // Better balance of speed vs quality than slow
      "-profile:v",
      "high",
      "-crf",
      "18", // High quality, visually lossless
      "-g",
      "30", // GOP size for keyframes
      "-keyint_min",
      "30",
      "-sc_threshold",
      "0",
      "-movflags",
      "+faststart",
      "-max_muxing_queue_size",
      "1024",
      "-threads",
      "2", // Limit threads to prevent resource exhaustion
      "-tune",
      "film", // Optimized for film-like content
      "-y",
    ];

    // Add duration if specified
    if (duration) {
      options.unshift("-t", duration.toString());
    }

    return options;
  }
}

// Create and export a singleton instance
export const ffmpegRenderer = new FFmpegRenderer();
