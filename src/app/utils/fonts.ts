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
// Prioritizes fonts with good Unicode support
export const FALLBACK_FONTS: LocalFont[] = [
  {
    family: "NotoSans",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/NotoSans-Regular.ttf",
      "700": "/fonts/files/NotoSans-Bold.ttf",
    },
  },
  {
    family: "OpenSans",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/OpenSans-Regular.ttf",
      "700": "/fonts/files/OpenSans-Bold.ttf",
    },
  },
  {
    family: "Barlow",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Barlow-Regular.ttf",
      "700": "/fonts/files/Barlow-Bold.ttf",
    },
  },
  {
    family: "Nunito",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Nunito-Regular.ttf",
      "700": "/fonts/files/Nunito-Bold.ttf",
    },
  },
  {
    family: "Merriweather",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Merriweather-Regular.ttf",
      "700": "/fonts/files/Merriweather-Bold.ttf",
    },
  },
  {
    family: "Lora",
    weights: ["400", "700"],
    files: {
      "400": "/fonts/files/Lora-Regular.ttf",
      "700": "/fonts/files/Lora-Bold.ttf",
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

  const fontPath = font.files[weight];
  if (!fontPath) return null;

  // Always use the API route for proper CORS handling
  if (typeof window !== "undefined") {
    // Extract just the filename from the path since API route expects just filename
    const filename = fontPath.split("/").pop();

    // For production, use Google Fonts as primary with local API as fallback
    if (process.env.NEXT_PUBLIC_USE_GOOGLE_FONTS === "true") {
      // Try to get Google Fonts URL, but fall back to local if it fails
      try {
        const googleFontUrl = await getGoogleFontUrl(font.family, weight);
        if (googleFontUrl) {
          return googleFontUrl;
        }
      } catch (error) {
        console.log(`[FONTS] Error getting Google Font, using local:`, error);
      }
    }

    return `/api/fonts/files/${filename}`;
  }

  return fontPath;
};

// Cache for Google Fonts API data - make it global and persistent
const GOOGLE_FONTS_CACHE_KEY = "google-fonts-api-data";
let googleFontsData: any = null;
let googleFontsPromise: Promise<any> | null = null;

// Cache for font URL results to prevent duplicate API calls
const fontUrlCache = new Map<string, string | null>();

/**
 * Get Google Fonts URL for common fonts using direct TTF files
 */
const getGoogleFontUrl = async (
  fontFamily: string,
  weight: string
): Promise<string | null> => {
  // Create cache key
  const cacheKey = `${fontFamily}-${weight}`;

  // Return cached result if available
  if (fontUrlCache.has(cacheKey)) {
    return fontUrlCache.get(cacheKey) || null;
  }

  // Map of Google Fonts available for web use
  const googleFonts: Record<string, string> = {
    OpenSans: "Open Sans",
    Roboto: "Roboto",
    Lato: "Lato",
    Montserrat: "Montserrat",
    Poppins: "Poppins",
    Nunito: "Nunito",
    Raleway: "Raleway",
    Inter: "Inter",
    Playfair: "Playfair Display",
    SourceSans: "Source Sans Pro",
    Oswald: "Oswald",
    Merriweather: "Merriweather",
    Lora: "Lora",
    PTSans: "PT Sans",
    Ubuntu: "Ubuntu",
    Fira: "Fira Sans",
    Crimson: "Crimson Text",
    Libre: "Libre Baskerville",
    Arimo: "Arimo",
    Tinos: "Tinos",
    Cousine: "Cousine",
    // Add commonly used Google Fonts from your collection
    Arvo: "Arvo",
    ArchivoBlack: "Archivo Black",
    AlfaSlabOne: "Alfa Slab One",
    Anton: "Anton",
    Audiowide: "Audiowide",
    Bangers: "Bangers",
    Barlow: "Barlow",
    BarlowCondensed: "Barlow Condensed",
    Allura: "Allura",
  };

  const googleName = googleFonts[fontFamily];
  if (!googleName) {
    // Cache negative result
    fontUrlCache.set(cacheKey, null);
    return null;
  }

  try {
    // Load Google Fonts data if not cached
    if (!googleFontsData) {
      // Check localStorage cache first
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(GOOGLE_FONTS_CACHE_KEY);
        if (cached) {
          try {
            googleFontsData = JSON.parse(cached);
            // Only log once on initial load
            if (!fontUrlCache.size) {
              console.log(
                `[FONTS] Using cached Google Fonts data (${googleFontsData.items?.length || 0} fonts)`
              );
            }
          } catch (e) {
            console.log(`[FONTS] Invalid cache, will fetch fresh data`);
          }
        }
      }

      // If no cache or invalid cache, fetch from API (but only once)
      if (!googleFontsData) {
        if (!googleFontsPromise) {
          console.log(`[FONTS] Loading Google Fonts API data...`);
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY;
          if (!apiKey) {
            console.error('[FONTS] Google Fonts API key not found in environment variables');
            googleFontsPromise = null;
            return null;
          }
          
          googleFontsPromise = fetch(
            `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}`
          )
            .then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Google Fonts API error: ${response.status} ${response.statusText}`
                );
              }
              return response.json();
            })
            .then((data) => {
              googleFontsData = data;
              console.log(
                `[FONTS] Loaded ${googleFontsData.items?.length || 0} fonts from Google Fonts API`
              );

              // Cache to localStorage
              if (typeof window !== "undefined") {
                localStorage.setItem(
                  GOOGLE_FONTS_CACHE_KEY,
                  JSON.stringify(data)
                );
              }

              return data;
            })
            .catch((error) => {
              console.error(`[FONTS] Error loading Google Fonts:`, error);
              googleFontsPromise = null; // Reset promise on error
              return null;
            });
        }

        googleFontsData = await googleFontsPromise;
        if (
          !googleFontsData ||
          !googleFontsData.items ||
          googleFontsData.items.length === 0
        ) {
          console.error(`[FONTS] Google Fonts API returned no fonts`);
          return null;
        }
      }
    }

    // Find the font in Google Fonts data
    const fontData = googleFontsData.items?.find(
      (item: any) => item.family.toLowerCase() === googleName.toLowerCase()
    );

    if (!fontData) return null;

    // Map weight to Google Fonts variant format
    const weightVariant = weight === "400" ? "regular" : weight;

    // Get the direct TTF file URL
    const fontFileUrl =
      fontData.files?.[weightVariant] || fontData.files?.regular;

    // Cache the result (positive or negative)
    fontUrlCache.set(cacheKey, fontFileUrl || null);

    return fontFileUrl || null;
  } catch (error) {
    console.error("Error fetching Google Fonts data:", error);
    // Cache negative result on error
    fontUrlCache.set(cacheKey, null);
    return null;
  }
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
