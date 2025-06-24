// font-manager.ts
import fs from "fs";
import path from "path";
import axios from "axios";
import { FontDefinition, FontFile } from "./types";

/**
 * Manages font discovery, loading, and caching for video rendering
 */
export class FontManager {
  private fontCache: Map<string, FontFile> = new Map();
  private readonly fontsDir: string;
  private availableFonts: FontDefinition[] = [];
  private systemFontPaths: string[] = [];
  private downloadedFonts: Set<string> = new Set();

  /**
   * Creates a new FontManager
   */
  constructor() {
    // Set up fonts directory
    this.fontsDir = path.join(process.cwd(), "fonts");

    // Create fonts directory if it doesn't exist
    if (!fs.existsSync(this.fontsDir)) {
      fs.mkdirSync(this.fontsDir, { recursive: true });
      console.log(`Created fonts directory at ${this.fontsDir}`);
    }

    // Define system font directories based on platform
    this.systemFontPaths = [
      // Linux
      "/usr/share/fonts",
      "/usr/local/share/fonts",
      // macOS
      "/Library/Fonts",
      "/System/Library/Fonts",
      // Windows - convert paths if necessary
      process.platform === "win32" ? "C:\\Windows\\Fonts" : "",
    ].filter(Boolean);

    // Load available fonts
    this.loadAvailableFonts();
  }

  /**
   * Set available fonts definitions for lookup
   */
  public setAvailableFonts(fonts: FontDefinition[]): void {
    this.availableFonts = fonts;
    console.log(`Set ${fonts.length} available font definitions`);
  }

  /**
   * Loads available fonts from the system and fonts directory
   */
  private loadAvailableFonts(): void {
    // Scan the fonts directory and system font paths for fonts
    console.log("Scanning for available fonts...");

    try {
      // Scan local fonts directory
      if (fs.existsSync(this.fontsDir)) {
        const localFonts = fs
          .readdirSync(this.fontsDir)
          .filter((file) => file.endsWith(".ttf") || file.endsWith(".otf"));

        console.log(
          `Found ${localFonts.length} font files in local fonts directory`
        );
      }

      // Scan system font directories
      for (const fontPath of this.systemFontPaths) {
        if (fs.existsSync(fontPath)) {
          console.log(`System font directory exists: ${fontPath}`);
        }
      }
    } catch (error) {
      console.error("Error scanning for fonts:", error);
    }
  }

  /**
   * Get a font file path for a given font family and weight
   * Will download the font if it doesn't exist locally
   */
  public async getFontFile(
    family: string,
    weight: string = "400",
    text?: string
  ): Promise<FontFile | null> {
    // Normalize font family and weight
    const normalizedFamily = this.normalizeFontFamily(family);
    const normalizedWeight = this.normalizeFontWeight(weight);

    // Generate a unique key for this font request
    const fontKey = `${normalizedFamily}-${normalizedWeight}`;

    // Check if we have this font in the cache
    if (this.fontCache.has(fontKey)) {
      return this.fontCache.get(fontKey) || null;
    }

    console.log(
      `Looking for font: ${normalizedFamily} (weight: ${normalizedWeight})`
    );

    // Look for the font locally first
    const localFontFile = await this.findLocalFontFile(
      normalizedFamily,
      normalizedWeight
    );

    if (localFontFile) {
      // Check if the font supports the required characters
      if (text && !(await this.fontSupportsText(localFontFile, text))) {
        console.log(
          `Font ${normalizedFamily} found but doesn't support required characters, trying fallback`
        );
        const fallbackFontFile = await this.getFallbackFontFile(text);
        if (fallbackFontFile) {
          this.fontCache.set(fontKey, fallbackFontFile);
          return fallbackFontFile;
        }
      }

      // Cache and return the local font file
      this.fontCache.set(fontKey, localFontFile);
      return localFontFile;
    }

    // If we haven't already tried to download this font, try to download it
    if (!this.downloadedFonts.has(fontKey)) {
      try {
        this.downloadedFonts.add(fontKey); // Mark as attempted
        const downloadedFontFile = await this.downloadFont(
          normalizedFamily,
          normalizedWeight
        );

        if (downloadedFontFile) {
          // Cache and return the downloaded font file
          this.fontCache.set(fontKey, downloadedFontFile);
          return downloadedFontFile;
        }
      } catch (error) {
        console.error(
          `Error downloading font ${normalizedFamily} (${normalizedWeight}):`,
          error
        );
      }
    }

    // Fall back to a system font if we couldn't find or download the requested font
    const fallbackFontFile = await this.getFallbackFontFile(text);

    if (fallbackFontFile) {
      console.log(
        `Using fallback font for ${normalizedFamily}: ${fallbackFontFile.path}`
      );
      return fallbackFontFile;
    }

    // If all else fails, return null
    console.error(
      `Could not find or download font: ${normalizedFamily} (${normalizedWeight})`
    );
    return null;
  }

  /**
   * Find a font file locally using metadata and file system lookup
   */
  private async findLocalFontFile(
    family: string,
    weight: string
  ): Promise<FontFile | null> {
    console.log(`Looking for font: ${family} (weight: ${weight})`);

    // First, try to find font using metadata
    try {
      // Load font metadata
      const metadataPath = path.join(
        process.cwd(),
        "public",
        "fonts",
        "font-metadata.json"
      );
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

        // Look for exact family match
        const fontMeta = metadata.find(
          (font: any) =>
            font.family === family ||
            font.family.replace(/\s+/g, "") === family.replace(/\s+/g, "")
        );

        if (fontMeta && fontMeta.files && fontMeta.files[weight]) {
          // Convert URL path to file system path
          const urlPath = fontMeta.files[weight];
          const filePath = path.join(process.cwd(), "public", urlPath);

          if (fs.existsSync(filePath)) {
            console.log(`Found font via metadata: ${filePath}`);
            return {
              path: filePath,
              family,
              weight,
            };
          } else {
            console.warn(
              `Font metadata points to non-existent file: ${filePath}`
            );
          }
        }

        // Try to find closest weight if exact weight not available
        if (fontMeta && fontMeta.files) {
          const availableWeights = Object.keys(fontMeta.files);
          if (availableWeights.length > 0) {
            // Use first available weight as fallback
            const fallbackWeight = availableWeights[0];
            const urlPath = fontMeta.files[fallbackWeight];
            const filePath = path.join(process.cwd(), "public", urlPath);

            if (fs.existsSync(filePath)) {
              console.log(
                `Found font with fallback weight ${fallbackWeight}: ${filePath}`
              );
              return {
                path: filePath,
                family,
                weight: fallbackWeight,
              };
            }
          }
        }
      }
    } catch (error) {
      console.warn("Error reading font metadata:", error);
    }

    // Fall back to file system search with naming patterns
    console.log(
      `Font not found in metadata, trying file system search for ${family} ${weight}`
    );

    // Weight name mapping for file naming
    const weightNameMap: Record<string, string> = {
      "100": "Thin",
      "200": "ExtraLight",
      "300": "Light",
      "400": "Regular",
      "500": "Medium",
      "600": "SemiBold",
      "700": "Bold",
      "800": "ExtraBold",
      "900": "Black",
    };

    // Convert weight to name
    const weightName = weightNameMap[weight] || "Regular";

    // Create a normalized font family name for file paths (remove spaces)
    const normalizedFontFamily = family.replace(/\s+/g, "");

    // Common naming patterns for font files - check actual fonts directory structure
    const fontFilePatterns = [
      // Standard format: Poppins-Bold.ttf
      `${normalizedFontFamily}-${weightName}.ttf`,
      // Lowercase weight: Poppins-regular.ttf
      `${normalizedFontFamily}-${weightName.toLowerCase()}.ttf`,
      // Underscore format: Poppins_Bold.ttf
      `${normalizedFontFamily}_${weightName}.ttf`,
      // With spaces: Poppins Bold.ttf
      `${family} ${weightName}.ttf`,
      // Just family name: Poppins.ttf (for single-weight fonts)
      `${normalizedFontFamily}.ttf`,
      // Other common variations
      `${normalizedFontFamily}${weightName}.ttf`,
      `${normalizedFontFamily}${weight}.ttf`,
      // Also check for OTF files
      `${normalizedFontFamily}-${weightName}.otf`,
      `${normalizedFontFamily}_${weightName}.otf`,
      `${family} ${weightName}.otf`,
      `${normalizedFontFamily}.otf`,
    ];

    console.log(
      `Checking for ${family} ${weightName} in local fonts directory`
    );

    // Check for files in the local fonts directory
    for (const pattern of fontFilePatterns) {
      const candidatePath = path.join(this.fontsDir, pattern);
      if (fs.existsSync(candidatePath)) {
        console.log(`Found local font file at ${candidatePath}`);
        return {
          path: candidatePath,
          family,
          weight,
        };
      }
    }

    // Check system font directories
    for (const systemDir of this.systemFontPaths) {
      if (!fs.existsSync(systemDir)) continue;

      for (const pattern of fontFilePatterns) {
        const candidatePath = path.join(systemDir, pattern);
        if (fs.existsSync(candidatePath)) {
          console.log(`Found system font at ${candidatePath}`);
          return {
            path: candidatePath,
            family,
            weight,
          };
        }
      }
    }

    // If the specific weight isn't found, try the Regular weight
    const defaultFontPath = path.join(
      this.fontsDir,
      `${normalizedFontFamily}-Regular.ttf`
    );
    if (fs.existsSync(defaultFontPath)) {
      console.log(`Found regular weight font at ${defaultFontPath}`);
      return {
        path: defaultFontPath,
        family,
        weight: "400",
      };
    }

    // Not found
    console.log(`Font not found: ${family} (${weight})`);
    return null;
  }

  /**
   * Download a font from Google Fonts with improved UTF-8 support
   */
  private async downloadFont(
    family: string,
    weight: string
  ): Promise<FontFile | null> {
    try {
      // Convert spaces in font family name to + for URL
      const urlFontFamily = family.replace(/\s+/g, "+");

      // Use a more reliable URL format with text parameter to ensure proper character set
      const sampleText =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя";
      const googleFontApiUrl = `https://fonts.googleapis.com/css2?family=${urlFontFamily}:wght@${weight}&text=${encodeURIComponent(sampleText)}&display=swap`;

      console.log(`Fetching font CSS from: ${googleFontApiUrl}`);

      // Special UA is needed for Google Fonts API to return more format options
      const response = await axios.get(googleFontApiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      // Parse the CSS to find font URLs
      const cssContent = response.data;

      // Try to find TTF/OTF first
      const fontUrlMatch = cssContent.match(
        /src:\s*url\(([^)]+\.(?:ttf|otf))\)/i
      );

      let fontFileUrl: string;
      let isTTF = true;

      if (!fontUrlMatch || !fontUrlMatch[1]) {
        // Try to find a woff2 URL as fallback
        const woff2Match = cssContent.match(/src:\s*url\(([^)]+\.woff2)\)/i);

        if (!woff2Match || !woff2Match[1]) {
          // Try any font URL as last resort
          const anyFontMatch = cssContent.match(/src:\s*url\(([^)]+)\)/i);

          if (!anyFontMatch || !anyFontMatch[1]) {
            console.error(
              `Could not find font URL in CSS response for ${family} (${weight})`
            );
            return null;
          }

          // Use whatever URL we found
          fontFileUrl = anyFontMatch[1];
          isTTF = false;
        } else {
          fontFileUrl = woff2Match[1];
          isTTF = false;
        }
      } else {
        fontFileUrl = fontUrlMatch[1];
      }

      console.log(`Found font URL: ${fontFileUrl}`);

      // Weight name mapping
      const weightNameMap: Record<string, string> = {
        "100": "Thin",
        "200": "ExtraLight",
        "300": "Light",
        "400": "Regular",
        "500": "Medium",
        "600": "SemiBold",
        "700": "Bold",
        "800": "ExtraBold",
        "900": "Black",
      };

      // Convert weight to name
      const weightName = weightNameMap[weight] || "Regular";

      // Create a normalized font family name for file paths (remove spaces)
      const normalizedFontFamily = family.replace(/\s+/g, "");

      // Define file path with UTF-8 suffix to indicate full character support
      const fontFileName = `${normalizedFontFamily}-${weightName}-UTF8.ttf`;
      const fontFilePath = path.join(this.fontsDir, fontFileName);

      // Download the font file
      const fontResponse = await axios.get(fontFileUrl, {
        responseType: "arraybuffer",
      });

      // Save the font file
      fs.writeFileSync(fontFilePath, Buffer.from(fontResponse.data));
      console.log(`Downloaded font to ${fontFilePath}`);

      return {
        path: fontFilePath,
        family,
        weight,
      };
    } catch (error) {
      console.error(`Error downloading font ${family} (${weight}):`, error);
      return null;
    }
  }

  /**
   * Normalize font weight to standard values
   */
  private normalizeFontWeight(weight: string | number): string {
    // Convert weight to string
    const weightStr = String(weight);

    // Map font-weight names to numbers
    const weightMap: Record<string, string> = {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900",
    };

    // Check if it's a named weight
    const normalizedWeight = weightMap[weightStr.toLowerCase()] || weightStr;

    // If it's a numeric weight, ensure it's a standard value
    const numericWeight = parseInt(weightStr, 10);
    if (!isNaN(numericWeight)) {
      // Standard weights defined by CSS
      const standardWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const closestWeight = standardWeights.reduce((prev, curr) => {
        return Math.abs(curr - numericWeight) < Math.abs(prev - numericWeight)
          ? curr
          : prev;
      });

      if (closestWeight !== numericWeight) {
        return String(closestWeight);
      }
    }

    return normalizedWeight;
  }

  /**
   * Normalize font family name
   */
  private normalizeFontFamily(family: string): string {
    // Remove quotes if present
    return family.replace(/^["']|["']$/g, "");
  }

  /**
   * Detect if text contains specific script types
   */
  private detectTextScript(text: string): string[] {
    const scripts = [];

    // Check for Cyrillic
    if (/[\u0400-\u04FF]/.test(text)) {
      scripts.push("cyrillic");
    }

    // Check for Arabic
    if (/[\u0600-\u06FF]/.test(text)) {
      scripts.push("arabic");
    }

    // Check for Chinese/Japanese/Korean
    if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text)) {
      scripts.push("cjk");
    }

    // Check for Devanagari (Hindi)
    if (/[\u0900-\u097F]/.test(text)) {
      scripts.push("devanagari");
    }

    // Default to Latin
    if (scripts.length === 0) {
      scripts.push("latin");
    }

    return scripts;
  }

  /**
   * Check if a font supports the characters in the given text
   */
  private async fontSupportsText(
    fontFile: FontFile,
    text: string
  ): Promise<boolean> {
    const scripts = this.detectTextScript(text);
    const fontFamily = fontFile.family.toLowerCase();

    // Known fonts that DON'T support extended Unicode (Cyrillic, Arabic, etc.)
    const latinOnlyFonts = [
      "bangers",
      "creepster",
      "pacifico",
      "lobster",
      "kaushan",
      "dancing",
      "caveat",
      "courgette",
      "gloria",
      "neucha",
      "permanent",
      "marker",
      "lucky",
      "bungee",
      "monoton",
      "concert",
      "carter",
      "alfa",
      "passion",
      "audiowide",
    ];

    // Check if this is a known Latin-only font
    const isLatinOnlyFont = latinOnlyFonts.some((name) =>
      fontFamily.includes(name)
    );

    if (isLatinOnlyFont) {
      // Check if we need non-Latin scripts
      for (const script of scripts) {
        if (script !== "latin") {
          console.log(
            `Font ${fontFile.family} doesn't support ${script} script (Latin-only font)`
          );
          return false;
        }
      }
    }

    // Known fonts with good Unicode support
    const unicodeFonts = [
      "notosans",
      "noto",
      "roboto",
      "opensans",
      "dejavusans",
      "liberationsans",
      "ubuntu",
      "sourcesans",
      "firasans",
      "inter",
      "lato",
      "montserrat",
      "nunito",
      "ptserif",
      "ptsans",
      "merriweather",
      "playfair",
      "libre",
      "source",
      "fira",
      "karla",
      "barlow",
      "heebo",
      "ibm",
      "cascadia",
    ];

    // Check if this is a known Unicode-supporting font
    const isUnicodeFont = unicodeFonts.some((name) =>
      fontFamily.includes(name)
    );

    if (isUnicodeFont) {
      return true; // Known good fonts
    }

    // For unknown fonts, be conservative with non-Latin scripts
    for (const script of scripts) {
      if (script !== "latin") {
        console.log(
          `Font ${fontFile.family} may not support ${script} script (unknown font)`
        );
        return false;
      }
    }

    return true; // Latin scripts should work with most fonts
  }

  /**
   * Get fallback fonts based on text content
   */
  private async getScriptSpecificFallbackFonts(
    text?: string
  ): Promise<string[]> {
    const scripts = text ? this.detectTextScript(text) : ["latin"];
    const fallbackFonts = [];

    for (const script of scripts) {
      switch (script) {
        case "cyrillic":
          fallbackFonts.push(
            "NotoSans-Regular.ttf",
            "NotoSans-Bold.ttf",
            "Roboto-Regular.ttf",
            "OpenSans-Regular.ttf"
          );
          break;
        case "arabic":
          fallbackFonts.push(
            "NotoSansArabic-Regular.ttf",
            "NotoSans-Regular.ttf"
          );
          break;
        case "cjk":
          fallbackFonts.push(
            "NotoSansSC-Regular.ttf",
            "NotoSansJP-Regular.ttf",
            "NotoSansTC-Regular.ttf",
            "NotoSans-Regular.ttf"
          );
          break;
        case "devanagari":
          fallbackFonts.push(
            "NotoSansDevanagari-Regular.ttf",
            "NotoSans-Regular.ttf"
          );
          break;
        default: // latin
          fallbackFonts.push(
            "OpenSans-Regular.ttf",
            "Roboto-Regular.ttf",
            "Barlow-Regular.ttf",
            "Nunito-Regular.ttf"
          );
      }
    }

    return Array.from(new Set(fallbackFonts)); // Remove duplicates
  }

  /**
   * Get a fallback font file
   */
  private async getFallbackFontFile(text?: string): Promise<FontFile | null> {
    // Get script-specific fallback fonts
    const fallbackFonts = await this.getScriptSpecificFallbackFonts(text);

    // Try local fonts directory with script-specific fallbacks
    const localFontsDir = path.join(process.cwd(), "public", "fonts", "files");

    for (const fontFile of fallbackFonts) {
      const fontPath = path.join(localFontsDir, fontFile);
      if (fs.existsSync(fontPath)) {
        console.log(`Found local fallback font: ${fontPath}`);
        const family = fontFile.split("-")[0]; // Extract family name
        return {
          path: fontPath,
          family,
          weight: "400",
        };
      }
    }

    // If no script-specific fonts found, try the original fallback directory
    for (const fontFile of fallbackFonts) {
      const fontPath = path.join(this.fontsDir, fontFile);
      if (fs.existsSync(fontPath)) {
        console.log(`Found local fallback font: ${fontPath}`);
        const family = fontFile.split("-")[0]; // Extract family name
        return {
          path: fontPath,
          family,
          weight: "400",
        };
      }
    }

    // Try to find a system font to use as fallback
    const systemFonts = [
      { path: "/System/Library/Fonts/Helvetica.ttc", family: "Helvetica" },
      {
        path: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        family: "Liberation Sans",
      },
      {
        path: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        family: "DejaVu Sans",
      },
      {
        path: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        family: "Liberation Sans",
      },
    ];

    for (const font of systemFonts) {
      if (fs.existsSync(font.path)) {
        console.log(`Found system fallback font: ${font.path}`);
        return {
          path: font.path,
          family: font.family,
          weight: "400",
        };
      }
    }

    // If we couldn't find any system fonts, try to download OpenSans
    try {
      console.log(
        "No local fonts found, attempting to download OpenSans as fallback"
      );
      return await this.downloadFont("OpenSans", "400");
    } catch (error) {
      console.error("Error downloading fallback font:", error);
      return null;
    }
  }

  /**
   * Prepare a font for FFmpeg use by ensuring it has a clean path
   * This can help with font rendering issues in FFmpeg
   */
  public async prepareFontForFFmpeg(fontFile: FontFile): Promise<string> {
    if (!fontFile || !fontFile.path) {
      console.error("Invalid font file provided to prepareFontForFFmpeg");
      return "";
    }

    // Check if font exists
    if (!fs.existsSync(fontFile.path)) {
      console.error(`Font file not found: ${fontFile.path}`);
      return fontFile.path;
    }

    // If the path already looks clean, just return it
    if (!/[^a-zA-Z0-9\/\-_\.]/g.test(fontFile.path)) {
      console.log(`Font path is already clean: ${fontFile.path}`);
      return fontFile.path;
    }

    // Create a simplified name for the font with UTF-8 marker
    const simpleName = `${fontFile.family.replace(/\s+/g, "")}_${fontFile.weight}_UTF8_ffmpeg.ttf`;
    const ffmpegFontDir = path.join(process.cwd(), "fonts", "ffmpeg");
    const targetPath = path.join(ffmpegFontDir, simpleName);

    // Create ffmpeg font directory if it doesn't exist
    if (!fs.existsSync(ffmpegFontDir)) {
      fs.mkdirSync(ffmpegFontDir, { recursive: true });
      console.log(`Created FFmpeg fonts directory at ${ffmpegFontDir}`);
    }

    // Copy the font to the new location if it doesn't already exist
    if (!fs.existsSync(targetPath)) {
      try {
        fs.copyFileSync(fontFile.path, targetPath);
        console.log(`Copied font to clean path: ${targetPath}`);
      } catch (error) {
        console.error(`Error copying font: ${error}`);
        return fontFile.path; // Fall back to original path
      }
    }

    // Verify the copy was successful
    if (fs.existsSync(targetPath)) {
      console.log(`Using FFmpeg-friendly font path: ${targetPath}`);
      return targetPath;
    }

    // Fall back to original path if copy failed
    return fontFile.path;
  }

  /**
   * Preload all fonts for a collection of elements
   */
  public async preloadFontsForElements(elements: any[]): Promise<void> {
    // Extract unique font requirements from elements
    const fontRequirements = new Set<string>();

    for (const element of elements) {
      if (element.type === "text" || element.type === "cta") {
        try {
          // Extract font family and weight
          let fontFamily = "Roboto";
          let fontWeight = "400";

          if (element.content) {
            try {
              const content =
                typeof element.content === "string"
                  ? JSON.parse(element.content)
                  : element.content;

              if (content.style) {
                fontFamily = content.style.fontFamily || fontFamily;
                fontWeight = content.style.fontWeight || fontWeight;
              }
            } catch (error) {
              // If parsing fails, use defaults
            }
          }

          fontRequirements.add(`${fontFamily}|${fontWeight}`);
        } catch (error) {
          console.error("Error extracting font info from element:", error);
        }
      }
    }

    // Preload all required fonts
    const promises: Promise<FontFile | null>[] = [];

    for (const req of Array.from(fontRequirements)) {
      const [family, weight] = req.split("|");
      promises.push(this.getFontFile(family, weight));
    }

    // Always preload OpenSans as a fallback
    promises.push(this.getFontFile("OpenSans", "400"));

    // Wait for all font loading to complete
    await Promise.all(promises);
    console.log(`Preloaded ${promises.length} fonts`);
  }
}

// Create and export a singleton instance
export const fontManager = new FontManager();
