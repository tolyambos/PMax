import path from "path";
import { parseElementContent, getScaledFontSize } from "../element-utils";
import { fontManager } from "./font-manager";
import {
  ElementRenderData,
  ParsedElementContent,
  ShapeType,
  CTAType,
} from "./types";
import * as fs from "fs";

/**
 * Handles converting elements to ffmpeg filter commands for rendering
 */
export class ElementRenderer {
  // FIXED: Element scaling factors should be 1.0 (no scaling) for consistency
  // The frontend editor and video rendering should use the same coordinate system
  private elementScaling: {
    [key: string]: { width: number; height: number };
  } = {
    // No scaling adjustments - elements should render exactly as designed
    cta: {
      width: 1.0,
      height: 1.0,
    },
    text: {
      width: 1.0,
      height: 1.0,
    },
    shape: {
      width: 1.0,
      height: 1.0,
    },
    image: {
      width: 1.0,
      height: 1.0,
    },
    logo: {
      width: 1.0,
      height: 1.0,
    },
  };

  // FIXED: Global scaling should be 1.0 (no scaling) for consistency
  // Both frontend and video rendering should use the same percentage-to-pixel conversion
  private globalScaling = {
    // No global scaling - use direct percentage to pixel conversion
    width: 1.0,
    height: 1.0,
    posX: 1.0,
    posY: 1.0,
  };

  /**
   * Get the scaling factor for an element type
   */
  private getScalingFactor(
    elementType: string,
    dimension: "width" | "height"
  ): number {
    return this.elementScaling[elementType]?.[dimension] || 1.0;
  }

  /**
   * Convert an element to ffmpeg filter commands
   */
  public async convertElementToFFmpegFilters(
    element: any,
    width: number,
    height: number,
    sceneIndex: number,
    format: string = "9:16"
  ): Promise<ElementRenderData> {
    // Parse the element content to extract text, styles, etc.
    const parsed = parseElementContent(element);

    // Create filter commands array
    const ffmpegFilterCommands: string[] = [];

    // Handle different element types
    switch (element.type) {
      case "text":
        await this.handleTextElement(
          element,
          parsed,
          width,
          height,
          ffmpegFilterCommands,
          format
        );
        break;
      case "cta":
        await this.handleCtaElement(
          element,
          parsed,
          width,
          height,
          ffmpegFilterCommands,
          format
        );
        break;
      case "shape":
        this.handleShapeElement(
          element,
          parsed,
          width,
          height,
          ffmpegFilterCommands,
          format
        );
        break;
      case "image":
      case "logo":
        await this.handleImageElement(
          element,
          width,
          height,
          ffmpegFilterCommands,
          format
        );
        break;
      case "video":
        // For video elements in a static scene, we just draw a placeholder
        this.handleVideoPlaceholder(
          element,
          width,
          height,
          ffmpegFilterCommands,
          format
        );
        break;
      case "audio":
        // For audio elements, we just draw a placeholder
        this.handleAudioPlaceholder(
          element,
          width,
          height,
          ffmpegFilterCommands,
          format
        );
        break;
      default:
        console.log(`Unknown element type: ${element.type}`);
        break;
    }

    return {
      element,
      width,
      height,
      sceneIndex,
      ffmpegFilterCommands,
    };
  }

  /**
   * Convert percentage position to pixels
   * FIXED: Direct conversion without scaling adjustments for consistency
   */
  private percentToPixels(
    percent: number,
    dimension: number,
    isCtaDimension: boolean = false
  ): number {
    // Direct percentage to pixel conversion - no scaling adjustments
    // This ensures frontend and video rendering use identical coordinate systems
    return (percent / 100) * dimension;
  }

  /**
   * Normalize percentage values
   */
  private normalizePercentage(value: number, defaultValue: number): number {
    // Handle undefined, null, or empty values
    if (value === undefined || value === null || isNaN(value)) {
      return defaultValue;
    }

    // Ensure value is between 0 and 100
    return Math.max(0, Math.min(100, value));
  }

  /**
   * Transform element coordinates from design format to target format
   * CRITICAL: This ensures elements position correctly across different video formats
   * while keeping vertical (9:16) format completely unchanged
   */
  private transformCoordinatesForFormat(
    element: any,
    targetFormat: string
  ): { x: number; y: number; width: number; height: number } {
    // If target format is vertical (9:16), return coordinates unchanged
    // This preserves existing vertical format behavior completely
    if (targetFormat === "9:16") {
      return {
        x: element.x || 0,
        y: element.y || 0,
        width: element.width || 20,
        height: element.height || 20,
      };
    }

    // For non-vertical formats, elements need coordinate transformation
    // Elements are typically designed for vertical format, so we transform them

    const originalX = element.x || 0;
    const originalY = element.y || 0;
    const originalWidth = element.width || 20;
    const originalHeight = element.height || 20;

    // Transform coordinates based on target format
    if (targetFormat === "16:9") {
      // Horizontal format transformation
      return {
        // X coordinate: scale and adjust for horizontal layout
        x: this.transformXForHorizontal(originalX),
        // Y coordinate: scale and center vertically
        y: this.transformYForHorizontal(originalY),
        // Width: adjust for horizontal aspect ratio
        width: this.transformWidthForHorizontal(originalWidth),
        // Height: adjust for horizontal aspect ratio
        height: this.transformHeightForHorizontal(originalHeight),
      };
    } else if (targetFormat === "1:1") {
      // Square format transformation
      return {
        x: this.transformXForSquare(originalX),
        y: this.transformYForSquare(originalY),
        width: this.transformWidthForSquare(originalWidth),
        height: this.transformHeightForSquare(originalHeight),
      };
    } else if (targetFormat === "4:5") {
      // Portrait format transformation
      return {
        x: this.transformXForPortrait(originalX),
        y: this.transformYForPortrait(originalY),
        width: this.transformWidthForPortrait(originalWidth),
        height: this.transformHeightForPortrait(originalHeight),
      };
    }

    // Default: return original coordinates
    return {
      x: originalX,
      y: originalY,
      width: originalWidth,
      height: originalHeight,
    };
  }

  /**
   * Transform X coordinate for horizontal (16:9) format
   */
  private transformXForHorizontal(originalX: number): number {
    // For horizontal format, we have more width space
    // Elements positioned on the left should stay left but with adjusted spacing
    if (originalX <= 20) {
      return originalX; // Keep left-aligned elements in similar position
    } else if (originalX >= 70) {
      // Right-aligned elements should move inward a bit
      return Math.max(60, originalX - 10);
    } else {
      // Center elements - adjust slightly toward center
      return originalX - 5;
    }
  }

  /**
   * Transform Y coordinate for horizontal (16:9) format
   */
  private transformYForHorizontal(originalY: number): number {
    // For horizontal format, we have less height space
    // Need to compress vertical positioning
    if (originalY <= 20) {
      // Top elements - keep near top but adjust for less height
      return originalY + 5;
    } else if (originalY >= 70) {
      // Bottom elements - move up more since we have less height
      return Math.max(50, originalY - 20);
    } else {
      // Middle elements - compress toward center
      return originalY - 10;
    }
  }

  /**
   * Transform width for horizontal (16:9) format
   */
  private transformWidthForHorizontal(originalWidth: number): number {
    // In horizontal format, we can afford slightly smaller widths
    // since we have more horizontal space
    return Math.max(20, originalWidth * 0.8);
  }

  /**
   * Transform height for horizontal (16:9) format
   */
  private transformHeightForHorizontal(originalHeight: number): number {
    // In horizontal format, elements might need to be slightly taller
    // to maintain visual proportion
    return originalHeight * 1.1;
  }

  /**
   * Transform coordinates for square (1:1) format
   */
  private transformXForSquare(originalX: number): number {
    // Square format: balanced approach
    return originalX;
  }

  private transformYForSquare(originalY: number): number {
    // Square format: slight vertical adjustment
    if (originalY >= 70) {
      return Math.max(60, originalY - 10);
    }
    return originalY;
  }

  private transformWidthForSquare(originalWidth: number): number {
    return originalWidth * 0.9;
  }

  private transformHeightForSquare(originalHeight: number): number {
    return originalHeight * 0.95;
  }

  /**
   * Transform coordinates for portrait (4:5) format
   */
  private transformXForPortrait(originalX: number): number {
    return originalX;
  }

  private transformYForPortrait(originalY: number): number {
    // Portrait is similar to vertical but slightly different ratio
    return originalY * 0.95;
  }

  private transformWidthForPortrait(originalWidth: number): number {
    return originalWidth * 0.95;
  }

  private transformHeightForPortrait(originalHeight: number): number {
    return originalHeight * 0.98;
  }

  /**
   * Calculate element position and size in pixels
   */
  private calculateElementPixels(
    element: any,
    width: number,
    height: number,
    format: string = "9:16"
  ): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    // Apply format-aware coordinate transformation
    const transformedCoords = this.transformCoordinatesForFormat(
      element,
      format
    );

    // Use transformed coordinates
    const x = transformedCoords.x;
    const y = transformedCoords.y;
    const elementWidth = transformedCoords.width;
    const elementHeight = transformedCoords.height;

    // Get element-specific scaling factors
    const elementType = element.type || "shape";
    const elementSpecificScaling = this.elementScaling[elementType] || {
      width: 1.0,
      height: 1.0,
    };

    console.log(`Element scaling for ${elementType}:`, {
      elementId: element.id,
      type: elementType,
      rawWidth: elementWidth,
      rawHeight: elementHeight,
      elementSpecificWidthScale: elementSpecificScaling.width,
      elementSpecificHeightScale: elementSpecificScaling.height,
      globalWidthScale: this.globalScaling.width,
      globalHeightScale: this.globalScaling.height,
      combinedWidthScale:
        elementSpecificScaling.width * this.globalScaling.width,
      combinedHeightScale:
        elementSpecificScaling.height * this.globalScaling.height,
    });

    // Special handling for image elements with keep proportions
    if (
      (element.type === "image" || element.type === "logo") &&
      element.content
    ) {
      try {
        const imageContent = JSON.parse(element.content);
        const keepProportions = imageContent.keepProportions !== false; // default to true

        if (keepProportions) {
          // Calculate the actual displayed image dimensions when keeping proportions
          const aspectRatio = elementWidth / elementHeight;
          const containerPixelWidth = this.percentToPixels(elementWidth, width);
          const containerPixelHeight = this.percentToPixels(
            elementHeight,
            height
          );

          // Calculate how the image will actually be displayed within the container
          let actualImageWidth = containerPixelWidth;
          let actualImageHeight = containerPixelHeight;

          // The image uses objectFit: contain, so it fits within the container maintaining aspect ratio
          const containerAspectRatio =
            containerPixelWidth / containerPixelHeight;

          if (aspectRatio > containerAspectRatio) {
            // Image is wider than container - fit to width
            actualImageHeight = containerPixelWidth / aspectRatio;
          } else {
            // Image is taller than container - fit to height
            actualImageWidth = containerPixelHeight * aspectRatio;
          }

          // Apply scaling factors to actual image dimensions
          const scaledWidth = Math.round(
            actualImageWidth *
              elementSpecificScaling.width *
              this.globalScaling.width
          );

          const scaledHeight = Math.round(
            actualImageHeight *
              elementSpecificScaling.height *
              this.globalScaling.height
          );

          // Calculate centered position within the original container
          const containerPixelX =
            this.percentToPixels(this.normalizePercentage(x, 0), width) *
            this.globalScaling.posX;
          const containerPixelY =
            this.percentToPixels(this.normalizePercentage(y, 0), height) *
            this.globalScaling.posY;

          // Center the actual image within the container
          const pixelX =
            containerPixelX +
            (containerPixelWidth *
              elementSpecificScaling.width *
              this.globalScaling.width -
              scaledWidth) /
              2;
          const pixelY =
            containerPixelY +
            (containerPixelHeight *
              elementSpecificScaling.height *
              this.globalScaling.height -
              scaledHeight) /
              2;

          return {
            x: Math.round(pixelX),
            y: Math.round(pixelY),
            w: scaledWidth,
            h: scaledHeight,
          };
        }
      } catch (error) {
        console.warn(
          `Could not parse image content for element ${element.id}:`,
          error
        );
      }
    }

    // Default behavior for all other elements or images without keep proportions
    const scaledWidth = Math.round(
      this.percentToPixels(elementWidth, width) *
        elementSpecificScaling.width * // Element-specific width scale
        this.globalScaling.width // Global width scale
    );

    const scaledHeight = Math.round(
      this.percentToPixels(elementHeight, height) *
        elementSpecificScaling.height * // Element-specific height scale
        this.globalScaling.height // Global height scale
    );

    // Calculate positions
    const pixelX =
      this.percentToPixels(this.normalizePercentage(x, 0), width) *
      this.globalScaling.posX;
    const pixelY =
      this.percentToPixels(this.normalizePercentage(y, 0), height) *
      this.globalScaling.posY;

    return {
      x: Math.round(pixelX),
      y: Math.round(pixelY),
      w: scaledWidth,
      h: scaledHeight,
    };
  }

  /**
   * Handle text elements by converting to drawtext filters
   * Updated to properly handle text rotation with markers
   */
  private async handleTextElement(
    element: any,
    parsed: ParsedElementContent,
    width: number,
    height: number,
    filterCommands: string[],
    format: string = "9:16"
  ): Promise<void> {
    // Get text content
    const text = parsed.extractedText || "Text Element";

    // Get position and size
    const { x, y, w, h } = this.calculateElementPixels(
      element,
      width,
      height,
      format
    );

    // Get font family and weight
    const fontFamily = String(parsed.extractedFontFamily || "Roboto");
    const fontWeight = String(parsed.extractedFontWeight || "400");

    // Get colors
    const textColor = String(parsed.extractedStyle?.color || "white");
    const textAlign = String(parsed.extractedStyle?.textAlign || "center");
    const textDecoration = String(
      parsed.extractedStyle?.textDecoration || "none"
    );
    const fontStyle = String(parsed.extractedStyle?.fontStyle || "normal");
    const letterSpacing = String(
      parsed.extractedStyle?.letterSpacing || "normal"
    );
    const lineHeight = String(parsed.extractedStyle?.lineHeight || "normal");

    // Advanced debugging for text styling
    console.log(`FONT_DEBUG: Text styling for element ${element.id}:`, {
      text: text.substring(0, 30) + (text.length > 30 ? "..." : ""),
      fontFamily,
      fontWeight,
      textColor,
      textAlign,
      textDecoration,
      fontStyle,
      letterSpacing,
      lineHeight,
      elementDimensions: { x, y, w, h },
    });

    // Handle font size using shared function for consistency
    const rawFontSize = parsed.extractedStyle?.fontSize || "48px";
    const fontSize = getScaledFontSize(rawFontSize, width);

    // Get font file
    const fontFile = await fontManager.getFontFile(fontFamily, fontWeight);
    if (!fontFile) {
      console.error(
        `Could not find font file for ${fontFamily} (${fontWeight}), using fallback`
      );
      // Use a fallback font
      const fallbackFontFile = await fontManager.getFontFile("Arial", "400");
      if (!fallbackFontFile) {
        console.error(
          "Could not find even fallback font, text will not render correctly"
        );
        return;
      }

      // Prepare font for FFmpeg - this will create a "clean" font path
      // that's optimized for FFmpeg compatibility
      const optimizedFontPath =
        await fontManager.prepareFontForFFmpeg(fallbackFontFile);
      console.log(`Using optimized font path: ${optimizedFontPath}`);

      // Rotation handling has been removed as requested by user
      if (element.rotation && element.rotation !== 0) {
        console.log(
          `Text rotation of ${element.rotation} degrees is ignored (rotation removed)`
        );
      }

      // Use the fallback font file - rotation removed
      this.addDrawTextCommand(
        text,
        optimizedFontPath,
        fontSize,
        x,
        y,
        w,
        h,
        textColor,
        0, // rotation removed
        element.opacity || 1,
        filterCommands,
        textAlign,
        fontStyle === "italic",
        textDecoration
      );
      return;
    }

    // Prepare font for FFmpeg - this will create a "clean" font path
    // that's optimized for FFmpeg compatibility
    const optimizedFontPath = await fontManager.prepareFontForFFmpeg(fontFile);
    console.log(`Using optimized font path: ${optimizedFontPath}`);

    // Rotation handling has been removed as requested by user
    if (element.rotation && element.rotation !== 0) {
      console.log(
        `Text rotation of ${element.rotation} degrees is ignored (rotation removed)`
      );
    }

    // Add drawtext command with the proper font file
    this.addDrawTextCommand(
      text,
      optimizedFontPath,
      fontSize,
      x,
      y,
      w,
      h,
      textColor,
      0, // rotation removed
      element.opacity || 1,
      filterCommands,
      textAlign,
      fontStyle === "italic",
      textDecoration
    );
  }

  /**
   * Add a drawtext command to the filter commands array
   * Modified to properly handle text rotation using rotation markers
   */
  private addDrawTextCommand(
    text: string,
    fontFilePath: string,
    fontSize: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    rotation: number,
    opacity: number,
    filterCommands: string[],
    textAlign: string = "center",
    italic: boolean = false,
    textDecoration: string = "none"
  ): void {
    // Calculate position based on text alignment
    let textX = x + width / 2; // Default center alignment
    const textY = y + height / 2;

    if (textAlign === "left") {
      textX = x + 5; // Add small padding for left alignment
    } else if (textAlign === "right") {
      textX = x + width - 5; // Subtract padding for right alignment
    }

    console.log(
      `Using font for text "${text.substring(0, 30)}...": ${fontFilePath}`
    );

    // Check if font file exists
    if (!fs.existsSync(fontFilePath)) {
      console.error(`Font file not found: ${fontFilePath}`);
    } else {
      console.log(`Font file exists and is accessible: ${fontFilePath}`);
    }

    // Wrap text to fit within the container width
    const lines = this.wrapText(text, width, fontSize, fontFilePath);
    console.log(`Text wrapped into ${lines.length} lines:`, lines);

    // Calculate line height (typically 1.2 * fontSize)
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;

    // Calculate starting Y position to center the text block vertically
    const startY = textY - totalTextHeight / 2 + lineHeight / 2;

    // Build the x position expression based on text alignment
    let xPosition = `(${textX}-text_w/2)`; // Default center alignment
    if (textAlign === "left") {
      xPosition = `${textX}`;
    } else if (textAlign === "right") {
      xPosition = `(${textX}-text_w)`;
    }

    // Rotation handling has been removed as requested by user
    if (rotation !== 0) {
      console.log(
        `Text rotation of ${rotation} degrees is ignored (rotation removed)`
      );
    }

    // Generate a drawtext command for each line
    lines.forEach((line, index) => {
      const escapedText = this.escapeFFmpegText(line);
      const lineY = startY + index * lineHeight;

      let drawTextCommand = [
        "drawtext=",
        `fontfile='${fontFilePath.replace(/'/g, "'\\''")}'`,
        `:text='${escapedText}'`,
        `:fontsize=${fontSize}`,
        `:fontcolor=${this.normalizeColor(color)}@${opacity}`,
        `:x=${xPosition}`,
        `:y=${lineY}`,
      ].join("");

      // Add italic if needed
      if (italic) {
        drawTextCommand += `:italic=1`;
      }

      // Add underline if needed
      if (textDecoration === "underline") {
        drawTextCommand += `:underline=1`;
      } else if (textDecoration === "line-through") {
        drawTextCommand += `:strikeout=1`;
      }

      // Add to filter commands
      filterCommands.push(drawTextCommand);

      // Log the command for debugging
      const logCommand =
        drawTextCommand.length > 100
          ? drawTextCommand.substring(0, 100) + "..."
          : drawTextCommand;
      console.log(`Line ${index + 1} drawtext command: ${logCommand}`);
    });
  }

  /**
   * Wrap text to fit within specified width
   * Returns array of text lines that should fit within the container
   */
  private wrapText(
    text: string,
    maxWidth: number,
    fontSize: number,
    fontFamily: string
  ): string[] {
    // If the text is short, check if it likely fits in one line
    // Use a more conservative approach to match browser behavior better

    // Better font-specific character width estimation
    let avgCharWidth: number;
    const fontFamilyLower = fontFamily.toLowerCase();

    if (
      fontFamilyLower.includes("mono") ||
      fontFamilyLower.includes("courier")
    ) {
      // Monospace fonts - more predictable width
      avgCharWidth = fontSize * 0.6;
    } else if (
      fontFamilyLower.includes("condensed") ||
      fontFamilyLower.includes("narrow")
    ) {
      // Condensed fonts are narrower
      avgCharWidth = fontSize * 0.45;
    } else if (
      fontFamilyLower.includes("extended") ||
      fontFamilyLower.includes("expanded")
    ) {
      // Extended fonts are wider
      avgCharWidth = fontSize * 0.7;
    } else {
      // Regular fonts - be more conservative to match browser wrapping
      // Use a smaller multiplier to be less aggressive about wrapping
      avgCharWidth = fontSize * 0.5;
    }

    // Calculate approximate max characters, but be more conservative
    const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

    // If the text is likely to fit in one line, don't wrap it
    // This helps match the browser's behavior better
    if (text.length <= maxCharsPerLine * 1.2) {
      return [text];
    }

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word;

      // Use actual pixel width approximation instead of just character count
      const testLineWidth = testLine.length * avgCharWidth;

      if (testLineWidth <= maxWidth * 0.9) {
        // Use 90% of width for safety margin
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, split it
          lines.push(word);
          currentLine = "";
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  }

  /**
   * Properly escape text for FFmpeg drawtext filter
   */
  private escapeFFmpegText(text: string): string {
    // Replace single quotes with escaped single quotes for FFmpeg
    let escapedText = text.replace(/'/g, "'\\''");
    // Escape colons (since they're used as separators in filter_complex)
    escapedText = escapedText.replace(/:/g, "\\:");
    // Escape backslashes
    escapedText = escapedText.replace(/\\/g, "\\\\");

    return escapedText;
  }

  /**
   * Draw the background for CTA elements
   * This version creates proper rotation markers when needed
   */
  private drawCtaBackground(
    ctaType: CTAType | string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    rotation: number,
    opacity: number,
    filterCommands: string[],
    parsed?: ParsedElementContent
  ): void {
    // Normalize color
    const normalizedColor = this.normalizeColor(color);

    // Extract border properties if they exist
    const borderWidth = parsed?.extractedStyle?.borderWidth
      ? parseInt(String(parsed.extractedStyle.borderWidth).replace("px", ""))
      : 0;

    const borderColor = parsed?.extractedStyle?.borderColor
      ? String(parsed.extractedStyle.borderColor)
      : "#000000";

    const normalizedBorderColor = this.normalizeColor(borderColor);

    // Extract shadow properties if they exist
    const boxShadow = parsed?.extractedStyle?.boxShadow;
    const hasShadow = boxShadow && boxShadow !== "none";

    // Log dimensions for debugging the scaling
    console.log(`CTA Rendering Debug - ${ctaType}:`, {
      x,
      y,
      width,
      height,
      borderWidth,
      rotation,
      parsed: parsed ? "Available" : "Not available",
    });

    // Rotation handling has been removed as requested by user
    if (rotation && rotation !== 0) {
      console.log(
        `CTA rotation of ${rotation} degrees is ignored (rotation removed)`
      );
    }

    // Always use standard approach (no rotation)
    switch (ctaType) {
      case "button":
        // Draw main background
        const drawCmd = `drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${normalizedColor}@${opacity}:t=fill`;
        filterCommands.push(drawCmd);

        // Draw border if width > 0
        if (borderWidth > 0) {
          // For borders, we draw a slightly larger box behind the main one
          const borderCmd = `drawbox=x=${x - borderWidth}:y=${y - borderWidth}:w=${width + borderWidth * 2}:h=${height + borderWidth * 2}:color=${normalizedBorderColor}@${opacity}:t=fill`;
          // Insert border command before the main background so it appears behind
          filterCommands.unshift(borderCmd);
        }

        // Add shadow effect if present
        if (hasShadow) {
          try {
            // Parse shadow values (this is a simplification)
            const shadowParts = String(boxShadow).split(" ");
            if (shadowParts.length >= 4) {
              const shadowOffsetX = parseInt(shadowParts[0]) || 3;
              const shadowOffsetY = parseInt(shadowParts[1]) || 3;
              // Draw shadow box slightly offset and behind everything
              const shadowCmd = `drawbox=x=${x + shadowOffsetX}:y=${y + shadowOffsetY}:w=${width}:h=${height}:color=black@0.3:t=fill`;
              // Insert at beginning so it's behind everything
              filterCommands.unshift(shadowCmd);
            }
          } catch (e) {
            console.error("Error parsing box shadow:", e);
          }
        }
        break;

      case "tag":
        // Draw main background
        const tagCmd = `drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${normalizedColor}@${opacity}:t=fill`;
        filterCommands.push(tagCmd);

        // Draw border if width > 0
        if (borderWidth > 0) {
          const borderCmd = `drawbox=x=${x - borderWidth}:y=${y - borderWidth}:w=${width + borderWidth * 2}:h=${height + borderWidth * 2}:color=${normalizedBorderColor}@${opacity}:t=fill`;
          filterCommands.unshift(borderCmd);
        }

        // Add shadow effect if present
        if (hasShadow) {
          try {
            const shadowParts = String(boxShadow).split(" ");
            if (shadowParts.length >= 4) {
              const shadowOffsetX = parseInt(shadowParts[0]) || 3;
              const shadowOffsetY = parseInt(shadowParts[1]) || 3;
              const shadowCmd = `drawbox=x=${x + shadowOffsetX}:y=${y + shadowOffsetY}:w=${width}:h=${height}:color=black@0.3:t=fill`;
              filterCommands.unshift(shadowCmd);
            }
          } catch (e) {
            console.error("Error parsing box shadow:", e);
          }
        }
        break;

      case "banner":
      default:
        // Draw main background
        const bannerCmd = `drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${normalizedColor}@${opacity}:t=fill`;
        filterCommands.push(bannerCmd);

        // Draw border if width > 0
        if (borderWidth > 0) {
          const borderCmd = `drawbox=x=${x - borderWidth}:y=${y - borderWidth}:w=${width + borderWidth * 2}:h=${height + borderWidth * 2}:color=${normalizedBorderColor}@${opacity}:t=fill`;
          filterCommands.unshift(borderCmd);
        }

        // Add shadow effect if present
        if (hasShadow) {
          try {
            const shadowParts = String(boxShadow).split(" ");
            if (shadowParts.length >= 4) {
              const shadowOffsetX = parseInt(shadowParts[0]) || 3;
              const shadowOffsetY = parseInt(shadowParts[1]) || 3;
              const shadowCmd = `drawbox=x=${x + shadowOffsetX}:y=${y + shadowOffsetY}:w=${width}:h=${height}:color=black@0.3:t=fill`;
              filterCommands.unshift(shadowCmd);
            }
          } catch (e) {
            console.error("Error parsing box shadow:", e);
          }
        }
        break;
    }
  }

  /**
   * Handle CTA (Call to Action) elements
   */
  private async handleCtaElement(
    element: any,
    parsed: ParsedElementContent,
    width: number,
    height: number,
    filterCommands: string[],
    format: string = "9:16"
  ): Promise<void> {
    // Get text content
    const text = parsed.extractedText || "Shop Now";

    // Get position and size
    const { x, y, w, h } = this.calculateElementPixels(
      element,
      width,
      height,
      format
    );

    // Get font family and weight
    const fontFamily = String(parsed.extractedFontFamily || "Roboto");
    const fontWeight = String(parsed.extractedFontWeight || "700");

    // Get colors
    const backgroundColor = String(
      parsed.extractedStyle?.backgroundColor || "#10B981"
    );
    const textColor = String(parsed.extractedStyle?.color || "white");

    // Handle font size using shared function for consistency
    const rawFontSize = parsed.extractedStyle?.fontSize || "36px";
    const fontSize = getScaledFontSize(rawFontSize, width);

    // Get CTA type
    const ctaType = parsed.extractedCtaType || "button";

    // First, draw the background shape based on CTA type
    this.drawCtaBackground(
      ctaType,
      x,
      y,
      w,
      h,
      backgroundColor,
      element.rotation || 0,
      element.opacity || 1,
      filterCommands,
      parsed // Pass parsed element to access border styles
    );

    // Get font file
    const fontFile = await fontManager.getFontFile(fontFamily, fontWeight);
    if (!fontFile) {
      console.error(
        `Could not find font file for ${fontFamily} (${fontWeight}), using fallback`
      );
      // Use a fallback font
      const fallbackFontFile = await fontManager.getFontFile("Arial", "700");
      if (!fallbackFontFile) {
        console.error(
          "Could not find even fallback font, text will not render correctly"
        );
        return;
      }

      // Prepare font for FFmpeg - this will create a "clean" font path
      // that's optimized for FFmpeg compatibility
      const optimizedFontPath =
        await fontManager.prepareFontForFFmpeg(fallbackFontFile);
      console.log(`Using optimized font path: ${optimizedFontPath}`);

      // Use the fallback font file
      this.addDrawTextCommand(
        text,
        optimizedFontPath,
        fontSize,
        x,
        y,
        w,
        h,
        textColor,
        0, // rotation removed
        element.opacity || 1,
        filterCommands,
        "center", // Default center alignment for CTAs
        false, // Not italic by default
        "none" // No text decoration by default
      );
      return;
    }

    // Prepare font for FFmpeg - this will create a "clean" font path
    // that's optimized for FFmpeg compatibility
    const optimizedFontPath = await fontManager.prepareFontForFFmpeg(fontFile);
    console.log(`Using optimized font path: ${optimizedFontPath}`);

    // Then, draw the text on top
    this.addDrawTextCommand(
      text,
      optimizedFontPath,
      fontSize,
      x,
      y,
      w,
      h,
      textColor,
      0, // rotation removed
      element.opacity || 1,
      filterCommands,
      String(parsed.extractedStyle?.textAlign || "center"),
      String(parsed.extractedStyle?.fontStyle) === "italic",
      String(parsed.extractedStyle?.textDecoration || "none")
    );
  }

  /**
   * Handle shape elements
   */
  private handleShapeElement(
    element: any,
    parsed: ParsedElementContent,
    width: number,
    height: number,
    filterCommands: string[],
    format: string = "9:16"
  ): void {
    // Get position and size
    const { x, y, w, h } = this.calculateElementPixels(
      element,
      width,
      height,
      format
    );

    // Get shape type
    const shapeType = parsed.extractedShapeType || "rectangle";

    // Get color
    const color = String(parsed.extractedStyle?.backgroundColor || "#3B82F6");
    const normalizedColor = this.normalizeColor(color);

    // Get opacity
    const opacity = element.opacity || 1;

    // Rotation handling has been removed as requested by user
    if (element.rotation && element.rotation !== 0) {
      console.log(
        `Shape rotation of ${element.rotation} degrees is ignored (rotation removed)`
      );
    }

    // Draw the shape based on type
    switch (shapeType) {
      case "circle":
        // Draw circle
        const radius = Math.min(w, h) / 2;
        const centerX = x + w / 2;
        const centerY = y + h / 2;

        // Use drawbox with forced square dimensions to create a crude circle
        // FFmpeg's filtering capabilities are limited, so this is an approximation
        // For better circles, you might need to overlay a PNG
        const drawCmd = `drawbox=x=${centerX - radius}:y=${centerY - radius}:w=${radius * 2}:h=${radius * 2}:color=${normalizedColor}@${opacity}:t=fill`;
        filterCommands.push(drawCmd);
        break;

      case "triangle":
        // Draw triangle using a sequence of drawline commands
        // This is an approximation as FFmpeg doesn't have a native triangle drawing command

        // Calculate triangle points
        const x1 = x + w / 2; // Top center
        const y1 = y;
        const x2 = x + w; // Bottom right
        const y2 = y + h;
        const x3 = x; // Bottom left
        const y3 = y + h;

        // Create commands to draw the three sides of the triangle
        const draw1 = `drawline=x1=${x1}:y1=${y1}:x2=${x2}:y2=${y2}:color=${normalizedColor}@${opacity}:thickness=${Math.max(w, h) / 10}`;
        const draw2 = `drawline=x1=${x2}:y1=${y2}:x2=${x3}:y2=${y3}:color=${normalizedColor}@${opacity}:thickness=${Math.max(w, h) / 10}`;
        const draw3 = `drawline=x1=${x3}:y1=${y3}:x2=${x1}:y2=${y1}:color=${normalizedColor}@${opacity}:thickness=${Math.max(w, h) / 10}`;

        // Since we can't fill the triangle in FFmpeg easily, we use thick lines
        filterCommands.push(draw1, draw2, draw3);
        break;

      case "rectangle":
      default:
        // Draw rectangle
        const rectCmd = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${normalizedColor}@${opacity}:t=fill`;
        filterCommands.push(rectCmd);
        break;
    }
  }

  /**
   * Handle image and logo elements
   */
  private async handleImageElement(
    element: any,
    width: number,
    height: number,
    filterCommands: string[],
    format: string = "9:16"
  ): Promise<void> {
    // If we have a URL, we need to process it separately by downloading the image
    // and then adding it as an overlay in a separate step

    // For now, just add a placeholder to the filter commands
    const { x, y, w, h } = this.calculateElementPixels(
      element,
      width,
      height,
      format
    );

    if (element.url) {
      // This will need to be handled by the main rendering process
      // We just add a placeholder command that will be replaced later
      filterCommands.push(
        `##IMAGE_OVERLAY:${element.id}:${x}:${y}:${w}:${h}:${element.rotation || 0}:${element.opacity || 1}##`
      );
    } else {
      // Draw placeholder rectangle
      const opacity = element.opacity || 1;
      const drawCmd = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=lightgray@${opacity}:t=fill`;
      filterCommands.push(drawCmd);

      // Add placeholder text
      const text = element.type === "logo" ? "Logo" : "Image";
      const fontFile = await fontManager.getFontFile("Arial", "400");
      if (fontFile) {
        // Prepare font for FFmpeg - this will create a "clean" font path
        // that's optimized for FFmpeg compatibility
        const optimizedFontPath =
          await fontManager.prepareFontForFFmpeg(fontFile);
        console.log(`Using optimized font path: ${optimizedFontPath}`);

        this.addDrawTextCommand(
          text,
          optimizedFontPath,
          16,
          x,
          y,
          w,
          h,
          "black",
          0, // rotation removed
          opacity,
          filterCommands,
          "center", // Default center alignment for image placeholders
          false, // Not italic by default
          "none" // No text decoration by default
        );
      }
    }
  }

  /**
   * Handle video element placeholder
   */
  private handleVideoPlaceholder(
    element: any,
    width: number,
    height: number,
    filterCommands: string[],
    format: string = "9:16"
  ): void {
    const { x, y, w, h } = this.calculateElementPixels(element, width, height);
    const opacity = element.opacity || 1;

    // Draw black background
    const bgCmd = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=black@${opacity}:t=fill`;
    filterCommands.push(bgCmd);

    // Draw play button (triangle)
    const triangleSize = Math.min(w, h) * 0.3;
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    // Calculate triangle points for play icon
    const px1 = centerX + triangleSize * 0.5;
    const py1 = centerY;
    const px2 = centerX - triangleSize * 0.25;
    const py2 = centerY - triangleSize * 0.4;
    const px3 = centerX - triangleSize * 0.25;
    const py3 = centerY + triangleSize * 0.4;

    const play1 = `drawline=x1=${px1}:y1=${py1}:x2=${px2}:y2=${py2}:color=white@${opacity}:thickness=${triangleSize / 10}`;
    const play2 = `drawline=x1=${px2}:y1=${py2}:x2=${px3}:y2=${py3}:color=white@${opacity}:thickness=${triangleSize / 10}`;
    const play3 = `drawline=x1=${px3}:y1=${py3}:x2=${px1}:y2=${py1}:color=white@${opacity}:thickness=${triangleSize / 10}`;

    filterCommands.push(play1, play2, play3);
  }

  /**
   * Handle audio element placeholder
   */
  private handleAudioPlaceholder(
    element: any,
    width: number,
    height: number,
    filterCommands: string[],
    format: string = "9:16"
  ): void {
    const { x, y, w, h } = this.calculateElementPixels(element, width, height);
    const opacity = element.opacity || 1;

    // Draw light gray background
    const bgCmd = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=lightgray@${opacity}:t=fill`;
    filterCommands.push(bgCmd);

    // Draw sound wave lines
    const centerY = y + h / 2;
    const waveHeight = h * 0.3;
    const waveWidth = w * 0.7;
    const startX = x + (w - waveWidth) / 2;
    const lineColor = this.normalizeColor("blue");

    // Draw a few wave lines
    for (let i = 0; i < 5; i++) {
      const lineX = startX + i * (waveWidth / 4);
      const height = Math.sin(i * 1.5) * waveHeight;
      const line = `drawline=x1=${lineX}:y1=${centerY}:x2=${lineX}:y2=${centerY + height}:color=${lineColor}@${opacity}:thickness=2`;
      filterCommands.push(line);
    }
  }

  /**
   * Normalize color value for ffmpeg with improved color accuracy
   */
  private normalizeColor(color: string): string {
    // Handle empty or undefined color
    if (!color) return "0xFFFFFF";

    // Process color for consistent formatting
    const processedColor = color.toLowerCase().trim();

    // Apply color correction for specific colors
    // This solves the mismatch between browser colors and FFmpeg rendering
    const exactColorMappings: Record<string, string> = {
      // Green shades - common CTA colors
      "#10b981": "0x10B981", // CTA green
      "rgb(16,185,129)": "0x10B981",
      "rgb(16, 185, 129)": "0x10B981",

      // Blue shades
      "#3b82f6": "0x3B82F6", // CTA blue
      "rgb(59,130,246)": "0x3B82F6",
      "rgb(59, 130, 246)": "0x3B82F6",

      // Red shades
      "#ef4444": "0xEF4444", // CTA red
      "rgb(239,68,68)": "0xEF4444",
      "rgb(239, 68, 68)": "0xEF4444",

      // Common grays
      "#f3f4f6": "0xF3F4F6", // Light gray background
      "#e5e7eb": "0xE5E7EB", // Lighter gray
      "#d1d5db": "0xD1D5DB", // Light gray
      "#9ca3af": "0x9CA3AF", // Medium gray
      "#6b7280": "0x6B7280", // Gray
      "#4b5563": "0x4B5563", // Dark gray

      // Exact matches for default brand colors
      "#111827": "0x111827", // Nearly black
      "#ffffff": "0xFFFFFF", // White
      "#000000": "0x000000", // Black

      // Common transparent colors
      transparent: "0x000000@0",
      "rgba(0,0,0,0)": "0x000000@0",
    };

    // Check for direct color mapping
    if (exactColorMappings[processedColor]) {
      return exactColorMappings[processedColor];
    }

    // If it's already in hex format
    if (processedColor.startsWith("#")) {
      // Remove # and ensure it's 6 characters
      let hex = processedColor.substring(1);
      if (hex.length === 3) {
        // Convert 3-character hex to 6-character
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }

      // Use uppercase for consistent FFmpeg handling
      return `0x${hex.toUpperCase()}`;
    }

    // Handle rgb() and rgba() formats
    if (processedColor.startsWith("rgb")) {
      try {
        // Extract RGB values with flexible regex
        const rgbMatch = processedColor.match(
          /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)/i
        );
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1]);
          const g = parseInt(rgbMatch[2]);
          const b = parseInt(rgbMatch[3]);
          const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1;

          // Convert to hex with padding
          const hexR = Math.min(255, Math.max(0, r))
            .toString(16)
            .padStart(2, "0");
          const hexG = Math.min(255, Math.max(0, g))
            .toString(16)
            .padStart(2, "0");
          const hexB = Math.min(255, Math.max(0, b))
            .toString(16)
            .padStart(2, "0");

          // Create the color string, with alpha channel if needed
          if (a < 1 && a >= 0) {
            return `0x${hexR}${hexG}${hexB}@${a}`.toUpperCase();
          }

          return `0x${hexR}${hexG}${hexB}`.toUpperCase();
        }
      } catch (error) {
        console.error("Error parsing RGB color:", error);
      }
    }

    // Named colors with optimized FFmpeg values
    const namedColors: Record<string, string> = {
      // Standard colors
      white: "0xFFFFFF",
      black: "0x000000",
      red: "0xFF0000",
      green: "0x00FF00",
      blue: "0x0000FF",
      yellow: "0xFFFF00",
      cyan: "0x00FFFF",
      magenta: "0xFF00FF",

      // Gray variations
      gray: "0x808080",
      grey: "0x808080",
      lightgray: "0xD3D3D3",
      lightgrey: "0xD3D3D3",
      darkgray: "0xA9A9A9",
      darkgrey: "0xA9A9A9",

      // Additional common colors
      orange: "0xFFA500",
      purple: "0x800080",
      violet: "0xEE82EE",
      brown: "0xA52A2A",
      pink: "0xFFC0CB",
      lime: "0x00FF00",
      olive: "0x808000",
      teal: "0x008080",
      navy: "0x000080",
      maroon: "0x800000",
    };

    // Check for named color
    if (namedColors[processedColor]) {
      return namedColors[processedColor];
    }

    // Last resort fallback - return white and log a warning
    console.warn(`Could not normalize color: ${color}, using default white`);
    return "0xFFFFFF";
  }

  /**
   * Process all elements in a scene
   */
  public async processSceneElements(
    elements: any[],
    width: number,
    height: number,
    sceneIndex: number,
    format: string = "9:16"
  ): Promise<string[]> {
    if (!elements || elements.length === 0) {
      console.log("No elements to process for scene");
      return [];
    }

    console.log(
      `Processing ${elements.length} elements for scene ${sceneIndex}`
    );

    // Sort elements by zIndex
    const sortedElements = [...elements].sort(
      (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
    );

    // Process each element
    const allFilterCommands: string[] = [];

    for (let i = 0; i < sortedElements.length; i++) {
      const element = sortedElements[i];
      const elementData = await this.convertElementToFFmpegFilters(
        element,
        width,
        height,
        sceneIndex,
        format
      );

      // Add element filter commands to the overall list
      allFilterCommands.push(...elementData.ffmpegFilterCommands);
    }

    return allFilterCommands;
  }
}

// Export a singleton instance
export const elementRenderer = new ElementRenderer();
