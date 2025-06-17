/**
 * Font Scanner
 *
 * This script scans your local fonts directory and generates a JSON file with metadata
 * about all available fonts. It extracts font family names and weights from filenames.
 */

const fs = require("fs");
const path = require("path");
const fontkit = require("fontkit");

// Paths
const fontsDir = path.join(process.cwd(), "fonts");
const outputPath = path.join(
  process.cwd(),
  "public",
  "fonts",
  "font-metadata.json"
);

// Weight name to weight value mapping
const WEIGHT_VALUES = {
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

// Create output directory if it doesn't exist
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory at ${outputDir}`);
}

/**
 * Parse font file name to extract family and weight
 * @param {string} filename
 * @returns {Object} Font information including family and weight
 */
function parseFontFilename(filename) {
  // Remove file extension
  const name = path.basename(filename, path.extname(filename));

  // Find the weight by checking for common weight names
  let weight = "400"; // Default to regular
  let family = name;

  Object.keys(WEIGHT_VALUES).forEach((weightName) => {
    if (name.endsWith(`-${weightName}`)) {
      weight = WEIGHT_VALUES[weightName];
      family = name.substring(0, name.length - weightName.length - 1);
      return;
    }
  });

  // Handle special cases where weight is part of the name but not at the end
  if (family.includes("-")) {
    const parts = family.split("-");
    const potentialWeight = parts[parts.length - 1];
    if (WEIGHT_VALUES[potentialWeight]) {
      weight = WEIGHT_VALUES[potentialWeight];
      family = parts.slice(0, parts.length - 1).join("-");
    }
  }

  return { family, weight };
}

/**
 * Read actual font metadata using fontkit
 * @param {string} fontPath
 * @returns {Object} Font metadata
 */
async function readFontMetadata(fontPath) {
  try {
    const font = fontkit.openSync(fontPath);
    return {
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      weight: font.weight,
      style: font.style,
      italic: font.italic,
    };
  } catch (error) {
    console.error(
      `Error reading font metadata for ${fontPath}:`,
      error.message
    );
    return null;
  }
}

/**
 * Scan fonts directory and generate metadata
 */
async function scanFonts() {
  console.log(`Scanning fonts in ${fontsDir}...`);

  try {
    // Get all font files
    const files = fs
      .readdirSync(fontsDir)
      .filter(
        (file) =>
          file.toLowerCase().endsWith(".ttf") ||
          file.toLowerCase().endsWith(".otf")
      );

    console.log(`Found ${files.length} font files.`);

    // Extract font data through filename parsing (fast but not always accurate)
    const fontsByFamily = {};

    // Group fonts by family
    for (const file of files) {
      const filePath = path.join(fontsDir, file);
      const { family, weight } = parseFontFilename(file);

      if (!fontsByFamily[family]) {
        fontsByFamily[family] = {
          family,
          weights: [],
          files: {},
        };
      }

      if (!fontsByFamily[family].weights.includes(weight)) {
        fontsByFamily[family].weights.push(weight);
      }

      // Store the path with a leading slash to make it absolute
      // This ensures it will always be relative to the domain root
      fontsByFamily[family].files[weight] = `/fonts/files/${file}`;
    }

    // Convert to array format
    const fontsList = Object.values(fontsByFamily);

    // Sort weights numerically
    fontsList.forEach((font) => {
      font.weights.sort((a, b) => parseInt(a) - parseInt(b));
    });

    // Sort by family name
    fontsList.sort((a, b) => a.family.localeCompare(b.family));

    // Create simplified format for the app
    const simplifiedFonts = fontsList.map((font) => ({
      family: font.family,
      weights: font.weights,
      files: font.files,
    }));

    // Write metadata to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(simplifiedFonts, null, 2));

    console.log(`✅ Font metadata saved to ${outputPath}`);
    console.log(`Found ${simplifiedFonts.length} font families.`);
    console.log(
      `Font files are accessible as absolute paths (/fonts/files/filename.ttf)`
    );
  } catch (error) {
    console.error("Error scanning fonts:", error);
  }
}

// Run the scanner
scanFonts().catch(console.error);
