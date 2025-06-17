"use client";

import { useEffect } from "react";
import { preloadAllFonts } from "@/app/utils/fonts";

// Client component to load fonts
export function FontLoader() {
  useEffect(() => {
    // Load all fonts when the component mounts
    preloadAllFonts();
  }, []);

  // This component doesn't render anything
  return null;
}
