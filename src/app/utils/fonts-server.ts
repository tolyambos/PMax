// app/utils/fonts-server.ts
// Server-side font utilities without React dependencies
import fs from "fs";
import path from "path";

// Types for local font metadata
interface LocalFont {
  family: string;
  weights: string[];
  files: Record<string, string>;
}

// Default fallback fonts if we can't load font metadata
export const FALLBACK_FONTS: LocalFont[] = [
  {
    family: "Arial",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Arial-Regular.ttf",
      "700": "/fonts/files/Arial-Bold.ttf",
    },
  },
  {
    family: "Helvetica",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Helvetica-Regular.ttf",
      "700": "/fonts/files/Helvetica-Bold.ttf",
    },
  },
  {
    family: "Times New Roman",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/TimesNewRoman-Regular.ttf",
      "700": "/fonts/files/TimesNewRoman-Bold.ttf",
    },
  },
];

// Cache for font metadata to avoid repeated file reads
let fontMetadata: LocalFont[] | null = null;

/**
 * Load font metadata from JSON file (server-side implementation)
 */
export const loadFontMetadata = (): LocalFont[] => {
  if (fontMetadata) return fontMetadata;

  try {
    const metadataPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "font-metadata.json"
    );
    const jsonData = fs.readFileSync(metadataPath, "utf8");
    fontMetadata = JSON.parse(jsonData);
    return fontMetadata || FALLBACK_FONTS;
  } catch (error) {
    console.error("Error loading font metadata on server:", error);
    return FALLBACK_FONTS;
  }
};

/**
 * Get all available font families
 */
export const getAllFontFamilies = (): string[] => {
  const fonts = loadFontMetadata();
  return fonts.map((font) => font.family);
};

/**
 * Get available weights for a specific font family
 */
export const getAvailableWeights = (fontFamily: string): string[] => {
  const fonts = loadFontMetadata();
  const font = fonts.find((f) => f.family === fontFamily);
  return font?.weights || ["400", "700"];
};

/**
 * Get a font stack with fallbacks
 */
export const getFontStack = (fontFamily: string): string => {
  // Strip quotes if present
  const cleanFamily = fontFamily.replace(/^["']|["']$/g, "");
  return `"${cleanFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
};

/**
 * Get the URL for a specific font family and weight
 */
export const getFontUrl = (
  fontFamily: string,
  weight: string = "400"
): string | null => {
  const fonts = loadFontMetadata();
  const font = fonts.find((f) => f.family === fontFamily);

  if (!font) {
    console.warn(`Font family "${fontFamily}" not found in metadata`);
    return null;
  }

  // If the exact weight isn't available, find the closest one
  if (!font.weights.includes(weight)) {
    console.warn(
      `Weight "${weight}" not available for font "${fontFamily}", using fallback`
    );
    // Just use the first available weight as fallback
    weight = font.weights[0] || "400";
  }

  return font.files[weight] || null;
};

// For backwards compatibility with Google Fonts code
export const GOOGLE_FONTS = FALLBACK_FONTS;

// This function is kept for backwards compatibility but returns a blank URL
export const generateGoogleFontsUrl = () => {
  console.warn(
    "generateGoogleFontsUrl is deprecated, local fonts are now used"
  );
  return "";
};
