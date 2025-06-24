// init-fonts.ts
// Initialize fonts on server startup

import { preloadAllFonts } from "./ensure-fonts";

export async function initializeFonts() {
  if (process.env.NODE_ENV === "production") {
    console.log("[FONT-INIT] Production mode detected, preloading fonts...");

    try {
      await preloadAllFonts();
      console.log("[FONT-INIT] Font preloading completed successfully");
    } catch (error) {
      console.error("[FONT-INIT] Error during font initialization:", error);
    }
  } else {
    console.log("[FONT-INIT] Development mode, skipping font preload");
  }
}

// Run initialization if this module is imported
if (typeof window === "undefined") {
  initializeFonts().catch((error) => {
    console.error("[FONT-INIT] Failed to initialize fonts:", error);
  });
}
