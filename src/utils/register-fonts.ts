// utils/register-fonts.ts
import { registerFont } from "canvas";
import fs from "fs";
import path from "path";

export function registerAllFonts() {
  const fontsDir = path.join(process.cwd(), "fonts");

  if (!fs.existsSync(fontsDir)) {
    console.warn("Fonts directory not found:", fontsDir);
    return;
  }

  // Read all files in the fonts directory
  const fontFiles = fs.readdirSync(fontsDir);

  // Weight name mapping
  const weightNameMap: Record<string, string> = {
    Thin: "100",
    ExtraLight: "200",
    Light: "300",
    Regular: "400",
    Medium: "500",
    SemiBold: "600",
    Bold: "700",
    ExtraBold: "800",
    Black: "900",
  };

  // Register each font file
  for (const fontFile of fontFiles) {
    if (!fontFile.endsWith(".ttf") && !fontFile.endsWith(".otf")) continue;

    const fontPath = path.join(fontsDir, fontFile);

    // Try to extract font family and weight from filename
    // Pattern like: Roboto-Bold.ttf, OpenSans-Regular.ttf
    const match = fontFile.match(
      /^([A-Za-z0-9]+)[-_]?([A-Za-z0-9]+)?\.(?:ttf|otf)$/
    );

    if (match) {
      let fontFamily = match[1];
      let fontWeight = match[2] ? weightNameMap[match[2]] || match[2] : "400";

      // Some common corrections
      if (fontWeight === "Regular") fontWeight = "400";
      if (fontWeight === "Bold") fontWeight = "700";

      try {
        // Register with family name
        registerFont(fontPath, { family: fontFamily, weight: fontWeight });

        // Also register without specifying weight for compatibility
        registerFont(fontPath, { family: fontFamily });

        console.log(
          `Registered font: ${fontFamily} (${fontWeight}) from ${fontFile}`
        );
      } catch (error) {
        console.error(`Failed to register font ${fontFile}:`, error);
      }
    } else {
      // For fonts with non-standard naming, just use the filename
      try {
        const baseName = path.basename(fontFile, path.extname(fontFile));
        registerFont(fontPath, { family: baseName });
        console.log(
          `Registered font with base name: ${baseName} from ${fontFile}`
        );
      } catch (error) {
        console.error(`Failed to register font ${fontFile}:`, error);
      }
    }
  }

  // Add fallback fonts
  const systemFonts = [
    { path: "/System/Library/Fonts/Helvetica.ttc", family: "Helvetica" },
    { path: "/System/Library/Fonts/Supplemental/Arial.ttf", family: "Arial" },
    {
      path: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      family: "DejaVu Sans",
    },
  ];

  for (const font of systemFonts) {
    if (fs.existsSync(font.path)) {
      try {
        registerFont(font.path, { family: font.family });
        console.log(`Registered system font: ${font.family}`);
      } catch (error) {
        console.error(`Failed to register system font ${font.family}:`, error);
      }
    }
  }
}
