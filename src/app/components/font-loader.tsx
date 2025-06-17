"use client";

import { useEffect } from "react";

// Client component to load fonts
export function FontLoader() {
  useEffect(() => {
    // Skip font loading in production to avoid errors
    if (process.env.NODE_ENV === "production") {
      console.log("Font loading disabled in production");
      return;
    }

    // Only load fonts in development
    try {
      const { preloadAllFonts } = require("@/app/utils/fonts");
      preloadAllFonts();
    } catch (error) {
      console.warn("Error loading fonts:", error);
    }
  }, []);

  // This component doesn't render anything
  return null;
}
