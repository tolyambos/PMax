// element-utils.ts - Enhanced to ensure font properties are preserved

/**
 * Creates standardized element content in JSON format
 */
export function createElementContent(
  text: string,
  style: { [key: string]: string | number } = {},
  additionalProps: { [key: string]: any } = {}
): string {
  // Ensure style properties are properly formatted
  const standardizedStyle = { ...style };

  // Make sure font properties are preserved exactly as provided
  if (standardizedStyle.fontFamily) {
    // Store fontFamily with quotes to preserve spaces
    standardizedStyle.fontFamily = String(standardizedStyle.fontFamily);
  }

  if (standardizedStyle.fontWeight) {
    // Ensure fontWeight is a string for consistent database storage
    standardizedStyle.fontWeight = String(standardizedStyle.fontWeight);
  }

  // Ensure border properties are properly preserved
  if (standardizedStyle.borderWidth) {
    standardizedStyle.borderWidth = String(standardizedStyle.borderWidth);
  }

  if (standardizedStyle.borderColor) {
    standardizedStyle.borderColor = String(standardizedStyle.borderColor);
  }

  if (standardizedStyle.borderRadius) {
    standardizedStyle.borderRadius = String(standardizedStyle.borderRadius);
  }

  if (standardizedStyle.borderStyle) {
    standardizedStyle.borderStyle = String(standardizedStyle.borderStyle);
  }

  // Ensure shadow properties are preserved
  if (standardizedStyle.boxShadow) {
    standardizedStyle.boxShadow = String(standardizedStyle.boxShadow);
  }

  // Ensure padding is preserved
  if (standardizedStyle.padding) {
    standardizedStyle.padding = String(standardizedStyle.padding);
  }

  const content = {
    text,
    style: standardizedStyle,
    ...additionalProps,
  };

  return JSON.stringify(content);
}

/**
 * Parses element content from JSON string or direct object
 */
export function parseElementContent(element: any): {
  extractedContent: any;
  extractedText: string | null;
  extractedStyle: { [key: string]: string | number } | null;
  extractedShapeType: "rectangle" | "circle" | "triangle" | null;
  extractedCtaType: "button" | "banner" | "tag" | null;
  extractedFontFamily: string | number | null;
  extractedFontWeight: string | number | null;
} {
  let extractedContent: any = null;
  let extractedText = "";
  let extractedStyle: { [key: string]: string | number } | null = null;
  let extractedShapeType: "rectangle" | "circle" | "triangle" | null = null;
  let extractedCtaType: "button" | "banner" | "tag" | null = null;
  let extractedFontFamily: string | number | null = null;
  let extractedFontWeight: string | number | null = null;

  try {
    // ENHANCED LOGGING: Log raw element.content before parsing
    console.log(`FONT_DEBUG: Raw element content for ${element.id}:`, {
      contentType: typeof element.content,
      contentLength: element.content ? element.content.length : 0,
      contentPreview:
        typeof element.content === "string"
          ? element.content.substring(0, 100) +
            (element.content.length > 100 ? "..." : "")
          : "Non-string content",
      elementType: element.type,
    });

    // Parse content if it's a string, or use it directly if it's already an object
    if (element.content) {
      if (
        typeof element.content === "string" &&
        element.content.trim().startsWith("{")
      ) {
        try {
          extractedContent = JSON.parse(element.content);
          console.log(
            `FONT_DEBUG: Successfully parsed JSON content for ${element.id}`
          );
        } catch (parseError) {
          console.error("Error parsing element content JSON:", parseError);
          console.log(
            `FONT_DEBUG: JSON parse error for ${element.id}, using content as text`
          );
          extractedContent = { text: element.content };
        }
      } else if (typeof element.content === "object") {
        console.log(
          `FONT_DEBUG: Content is already an object for ${element.id}`
        );
        extractedContent = element.content;
      } else {
        console.log(
          `FONT_DEBUG: Non-JSON content for ${element.id}, using as text`
        );
        extractedContent = { text: element.content };
      }

      // Extract the text content
      extractedText = extractedContent.text || "";

      // Extract style information
      extractedStyle = extractedContent.style || null;

      // Check if style exists directly on the element
      if (!extractedStyle && element.style) {
        console.log(
          `FONT_DEBUG: Using element.style directly for ${element.id}`
        );
        extractedStyle = element.style;
      }

      // Extract shape type if available
      extractedShapeType = extractedContent.shapeType || null;

      // Extract CTA type if available
      extractedCtaType = extractedContent.ctaType || null;

      // Extract font family and weight with detailed logging
      // Try multiple potential locations for font properties
      if (extractedStyle?.fontFamily) {
        extractedFontFamily = extractedStyle.fontFamily;
        console.log(
          `FONT_DEBUG: Found fontFamily in extractedStyle.fontFamily: "${extractedFontFamily}"`
        );
      } else if (extractedContent.fontFamily) {
        extractedFontFamily = extractedContent.fontFamily;
        console.log(
          `FONT_DEBUG: Found fontFamily in extractedContent.fontFamily: "${extractedFontFamily}"`
        );
      } else if (element.style?.fontFamily) {
        extractedFontFamily = element.style.fontFamily;
        console.log(
          `FONT_DEBUG: Found fontFamily in element.style.fontFamily: "${extractedFontFamily}"`
        );
      } else {
        console.log(
          `FONT_DEBUG: No fontFamily found for ${element.id}, using null`
        );
      }

      if (extractedStyle?.fontWeight) {
        extractedFontWeight = extractedStyle.fontWeight;
        console.log(
          `FONT_DEBUG: Found fontWeight in extractedStyle.fontWeight: "${extractedFontWeight}"`
        );
      } else if (extractedContent.fontWeight) {
        extractedFontWeight = extractedContent.fontWeight;
        console.log(
          `FONT_DEBUG: Found fontWeight in extractedContent.fontWeight: "${extractedFontWeight}"`
        );
      } else if (element.style?.fontWeight) {
        extractedFontWeight = element.style.fontWeight;
        console.log(
          `FONT_DEBUG: Found fontWeight in element.style.fontWeight: "${extractedFontWeight}"`
        );
      } else {
        console.log(
          `FONT_DEBUG: No fontWeight found for ${element.id}, using null`
        );
      }

      // Log the extracted font properties for debugging
      console.log(
        `FONT_DEBUG: Final extracted font properties for element ${element.id}:`,
        {
          fontFamily: extractedFontFamily,
          fontWeight: extractedFontWeight,
          extractedStyleKeys: extractedStyle
            ? Object.keys(extractedStyle)
            : "null",
          elementType: element.type,
        }
      );
    }
  } catch (error) {
    console.error("Error parsing element content:", error);
    // Fallback: treat content as plain text
    extractedText = typeof element.content === "string" ? element.content : "";
    console.log(
      `FONT_DEBUG: Error in parseElementContent for ${element.id}, using fallback text`
    );
  }

  return {
    extractedContent,
    extractedText,
    extractedStyle,
    extractedShapeType,
    extractedCtaType,
    extractedFontFamily,
    extractedFontWeight,
  };
}

/**
 * Normalizes a percentage value to ensure it's between 0-100
 */
export function normalizePercentage(
  value: number | string | undefined,
  defaultValue: number
): number {
  // Handle undefined, null, or empty values
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  // Convert string to number if needed
  const numericValue =
    typeof value === "number" ? value : parseFloat(String(value));

  // Handle NaN values after conversion
  if (isNaN(numericValue)) {
    return defaultValue;
  }

  // Ensure value is between 0 and 100
  return Math.max(0, Math.min(100, numericValue));
}

/**
 * Generates a unique element ID
 */
export function generateElementId(prefix: string = "element"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculates the center point of an element
 */
export function getElementCenter(
  element: any,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  // Parse values as numbers with fallbacks
  const elementX =
    typeof element.x === "number"
      ? element.x
      : parseFloat(String(element.x)) || 0;
  const elementY =
    typeof element.y === "number"
      ? element.y
      : parseFloat(String(element.y)) || 0;
  const elementWidth =
    typeof element.width === "number"
      ? element.width
      : parseFloat(String(element.width)) || 20;
  const elementHeight =
    typeof element.height === "number"
      ? element.height
      : parseFloat(String(element.height)) || 20;

  // Normalize all values for consistency
  const normalizedX = normalizePercentage(elementX, 50);
  const normalizedY = normalizePercentage(elementY, 50);
  const normalizedWidth = normalizePercentage(elementWidth, 20);
  const normalizedHeight = normalizePercentage(elementHeight, 20);

  // Calculate center in pixels
  const centerX = ((normalizedX + normalizedWidth / 2) * containerWidth) / 100;
  const centerY =
    ((normalizedY + normalizedHeight / 2) * containerHeight) / 100;

  return { x: centerX, y: centerY };
}

/**
 * Creates a duplicate of an element with a new ID
 */
export function duplicateElement(
  element: any,
  offsetX: number = 5,
  offsetY: number = 5
): any {
  // Parse values as numbers with fallbacks
  const elementX =
    typeof element.x === "number"
      ? element.x
      : parseFloat(String(element.x)) || 0;
  const elementY =
    typeof element.y === "number"
      ? element.y
      : parseFloat(String(element.y)) || 0;

  return {
    ...element,
    id: generateElementId(),
    x: elementX + offsetX,
    y: elementY + offsetY,
  };
}

/**
 * Convert a font size string to a scaled pixel value for rendering
 * CRITICAL: This function must be identical in both front-end and back-end rendering
 */
export function getScaledFontSize(
  fontSizeStr: string | number,
  canvasWidth: number
): number {
  // Parse font size from string (e.g., "48px" -> 48)
  let baseFontSize = 48; // Default size if parsing fails

  if (typeof fontSizeStr === "string") {
    const matches = fontSizeStr.match(/(\d+(\.\d+)?)/);
    if (matches && matches[1]) {
      baseFontSize = parseFloat(matches[1]);
    }
  } else if (typeof fontSizeStr === "number") {
    baseFontSize = fontSizeStr;
  }

  // Reference width for the design (assumed 1080 for vertical format)
  const referenceWidth = 1080;

  // Scale font size based on canvas width relative to reference width
  const scaleFactor = canvasWidth / referenceWidth;
  return Math.round(baseFontSize * scaleFactor);
}

/**
 * Gets a font stack with fallbacks for the specified font family
 */
export function getFontStack(fontFamily: string): string {
  // Strip quotes if present
  const cleanFamily = fontFamily.replace(/^["']|["']$/g, "");
  return `"${cleanFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
}

/**
 * Ensures consistent handling of rotation values
 */
export function normalizeRotation(
  rotation: number | string | undefined
): number {
  if (rotation === undefined) return 0;

  const parsedRotation =
    typeof rotation === "number" ? rotation : parseFloat(String(rotation));

  return isNaN(parsedRotation) ? 0 : Math.round(parsedRotation);
}

/**
 * Ensures consistent handling of opacity values
 */
export function normalizeOpacity(opacity: number | string | undefined): number {
  if (opacity === undefined) return 1;

  const parsedOpacity =
    typeof opacity === "number" ? opacity : parseFloat(String(opacity));

  return isNaN(parsedOpacity) ? 1 : Math.max(0, Math.min(1, parsedOpacity));
}

/**
 * Ensures consistent handling of z-index values
 */
export function normalizeZIndex(zIndex: number | string | undefined): number {
  if (zIndex === undefined) return 0;

  const parsedZIndex =
    typeof zIndex === "number" ? zIndex : parseInt(String(zIndex));

  return isNaN(parsedZIndex) ? 0 : parsedZIndex;
}

/**
 * Utility to load Google Fonts for browser environments
 */
export function loadGoogleFonts(
  fonts: string[] | { family: string; weights: (number | string)[] }[]
) {
  // Skip if running on server
  if (typeof window === "undefined") return;

  // Convert simple array to formatted array
  const formattedFonts =
    Array.isArray(fonts) && typeof fonts[0] === "string"
      ? (fonts as string[]).map((font) => ({
          family: font,
          weights: [400, 700],
        }))
      : (fonts as { family: string; weights: (number | string)[] }[]);

  // Create a query string for Google Fonts
  const fontFamilies = formattedFonts
    .map((font) => {
      const weights = font.weights.join(",");
      return `family=${font.family.replace(/ /g, "+")}:wght@${weights}`;
    })
    .join("&");

  // Create the link element
  const linkId = "google-fonts-link";
  // Remove existing link if it exists
  const existingLink = document.getElementById(linkId);
  if (existingLink) {
    document.head.removeChild(existingLink);
  }

  // Create new link element
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;
  document.head.appendChild(link);

  return link;
}

/**
 * Preload common Google Fonts for better performance
 */
export function preloadCommonFonts() {
  const commonFonts = [
    { family: "Roboto", weights: [300, 400, 500, 700] },
    { family: "Open Sans", weights: [300, 400, 600, 700] },
    { family: "Montserrat", weights: [300, 400, 500, 700] },
  ];

  return loadGoogleFonts(commonFonts);
}

/**
 * Get available weights for a given font family
 */
export function getAvailableWeights(fontFamily: string): number[] {
  // This function is deprecated and should not be used
  // Use the loadFontMetadata().then(fonts => ...) from fonts.ts instead
  console.warn(
    "getAvailableWeights in element-utils.ts is deprecated, use fonts.ts functions instead"
  );

  // Return default weights as fallback
  return [400, 700];
}
