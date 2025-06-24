"use client";

import { useEffect } from "react";

// Client component to load fonts
export function FontLoader() {
  useEffect(() => {
    // Load fonts in both development and production
    const loadFonts = async () => {
      try {
        const { preloadAllFonts } = await import("@/app/utils/fonts");
        await preloadAllFonts();
        console.log("Fonts loaded successfully");
      } catch (error) {
        console.warn("Error loading fonts:", error);
      }
    };

    loadFonts();
  }, []);

  // This component doesn't render anything
  return null;
}
