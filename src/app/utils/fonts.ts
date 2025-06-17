/* eslint-disable react-hooks/exhaustive-deps */
"use client";

// app/utils/fonts.ts
import { useEffect, useState } from "react";

// Types for local font metadata
export interface LocalFont {
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
    family: "Verdana",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Verdana-Regular.ttf",
      "700": "/fonts/files/Verdana-Bold.ttf",
    },
  },
  {
    family: "Georgia",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Georgia-Regular.ttf",
      "700": "/fonts/files/Georgia-Bold.ttf",
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

// Global state to store loaded font metadata
let fontMetadata: LocalFont[] | null = null;
let isLoadingFonts = false;

/**
 * Fetch and load the font metadata from the JSON file
 * This function can be called on-demand but is also called automatically
 * by other functions that need font data
 */
export const loadFontMetadata = async (): Promise<LocalFont[]> => {
  // Return cached metadata if available
  if (fontMetadata) return fontMetadata;

  // Prevent multiple simultaneous loads
  if (isLoadingFonts) {
    // Wait for loading to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (fontMetadata) {
          clearInterval(checkInterval);
          resolve(fontMetadata);
        }
      }, 100);
    });
  }

  isLoadingFonts = true;

  try {
    // Fetch the font metadata JSON
    const response = await fetch("/fonts/font-metadata.json");

    if (!response.ok) {
      console.error(
        "Failed to load font metadata, using fallbacks:",
        response.statusText
      );
      fontMetadata = FALLBACK_FONTS;
      return fontMetadata;
    }

    // Parse the font metadata
    fontMetadata = await response.json();
    return fontMetadata || FALLBACK_FONTS;
  } catch (error) {
    console.error("Error loading font metadata:", error);
    // Fallback to basic fonts
    fontMetadata = FALLBACK_FONTS;
    return fontMetadata;
  } finally {
    isLoadingFonts = false;
  }
};

/**
 * Get the list of all available font families
 */
export const getAllFontFamilies = async (): Promise<string[]> => {
  const fonts = await loadFontMetadata();
  return fonts.map((font) => font.family);
};

/**
 * Get available weights for a specific font family
 */
export const getAvailableWeights = async (
  fontFamily: string
): Promise<string[]> => {
  const fonts = await loadFontMetadata();
  const font = fonts.find((f) => f.family === fontFamily);
  return font?.weights || ["400", "700"];
};

/**
 * Get a font stack with fallbacks
 */
export const getFontStack = (fontFamily: string): string => {
  return `"${fontFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
};

/**
 * Get the URL for a specific font family and weight
 */
export const getFontUrl = async (
  fontFamily: string,
  weight: string = "400"
): Promise<string | null> => {
  const fonts = await loadFontMetadata();
  const font = fonts.find((f) => f.family === fontFamily);

  if (!font) return null;

  // Find closest weight if exact weight isn't available
  if (!font.weights.includes(weight)) {
    const numericWeight = parseInt(weight);
    const availableWeights = font.weights
      .map((w) => parseInt(w))
      .sort((a, b) => a - b);

    // Find the closest weight
    const closestWeight = availableWeights.reduce((prev, curr) => {
      return Math.abs(curr - numericWeight) < Math.abs(prev - numericWeight)
        ? curr
        : prev;
    }, availableWeights[0]);

    weight = closestWeight.toString();
  }

  return font.files[weight] || null;
};

/**
 * Preload a specific font to make it available for canvas and UI
 */
export const preloadFont = async (
  fontFamily: string,
  weight: string = "400"
): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  const fontUrl = await getFontUrl(fontFamily, weight);
  if (!fontUrl) return false;

  try {
    // Create a new font face
    const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, {
      weight,
      display: "swap",
    });

    // Load the font
    const loadedFont = await fontFace.load();

    // Add the font to the document
    document.fonts.add(loadedFont);

    // Force the font to be available
    document.fonts.ready.then(() => {
      console.log(`Font ${fontFamily} (${weight}) loaded and ready`);
    });

    return true;
  } catch (error) {
    console.error(`Error loading font ${fontFamily} (${weight}):`, error);
    return false;
  }
};

/**
 * Hook to use local fonts in React components
 */
export const useLocalFonts = (
  fontFamilies: string[] = [],
  weights: string[] = ["400", "700"]
) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadFonts = async () => {
      try {
        // Load the font metadata first
        const fonts = await loadFontMetadata();

        // Default to loading all fonts if none are specified
        const familiesToLoad =
          fontFamilies.length > 0
            ? fontFamilies
            : fonts.slice(0, 20).map((f) => f.family); // Limit to first 20 fonts for performance

        // Create font loading promises
        const loadPromises = familiesToLoad.flatMap((family) => {
          const font = fonts.find((f) => f.family === family);
          if (!font) return [];

          const weightsToLoad =
            weights.length > 0
              ? weights.filter((w) => font.weights.includes(w))
              : font.weights;

          return weightsToLoad.map((weight) => preloadFont(family, weight));
        });

        // Wait for all fonts to load
        await Promise.all(loadPromises);
        setLoaded(true);
      } catch (error) {
        console.error("Error in useLocalFonts:", error);
        // Mark as loaded anyway to prevent UI blocking
        setLoaded(true);
      }
    };

    loadFonts();
  }, [fontFamilies.join(","), weights.join(",")]);

  return loaded;
};

/**
 * Preload all available fonts (use carefully - this could be heavy with 1000+ fonts)
 */
export const preloadAllFonts = async (maxFonts: number = 50) => {
  if (typeof window === "undefined") return;

  try {
    // Load metadata
    const fonts = await loadFontMetadata();

    // Limit the number of fonts to preload to avoid performance issues
    const limitedFonts = fonts.slice(0, maxFonts);

    // Preload regular weight for each font
    const loadPromises = limitedFonts.map((font) => {
      // Prefer 400 (Regular) weight if available, otherwise use the first available weight
      const weight = font.weights.includes("400") ? "400" : font.weights[0];
      return preloadFont(font.family, weight);
    });

    await Promise.all(loadPromises);
    console.log(`Preloaded ${limitedFonts.length} fonts`);
  } catch (error) {
    console.error("Error preloading fonts:", error);
  }
};

/**
 * React component to load and register fonts
 */
export function FontLoader({
  preloadCount = 20,
  specificFonts = [],
}: {
  preloadCount?: number;
  specificFonts?: string[];
}) {
  useEffect(() => {
    if (specificFonts.length > 0) {
      // Load specific fonts
      Promise.all(specificFonts.map((font) => preloadFont(font)));
    } else {
      // Load popular fonts
      preloadAllFonts(preloadCount);
    }
  }, [preloadCount, specificFonts.join(",")]);

  return null; // Renders nothing
}

// Compatibility with old code - for backward compatibility
export const GOOGLE_FONTS = FALLBACK_FONTS;
export const generateGoogleFontsUrl = () => "";
export const useGoogleFonts = () => useLocalFonts();
