const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

// Font definitions - keep this in sync with your app's font list
const GOOGLE_FONTS = [
  { family: "Roboto", weights: ["300", "400", "500", "700"] },
  { family: "Open Sans", weights: ["300", "400", "600", "700"] },
  { family: "Montserrat", weights: ["300", "400", "500", "700", "800"] },
  { family: "Lato", weights: ["300", "400", "700", "900"] },
  { family: "Poppins", weights: ["300", "400", "500", "600", "700"] },
  { family: "Raleway", weights: ["300", "400", "500", "600", "700"] },
  { family: "Oswald", weights: ["300", "400", "500", "600", "700"] },
  { family: "Playfair Display", weights: ["400", "500", "600", "700", "800"] },
  { family: "Merriweather", weights: ["300", "400", "700", "900"] },
  { family: "Source Sans Pro", weights: ["300", "400", "600", "700"] },
];

// Weight name mapping
const WEIGHT_NAMES = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

// Create fonts directory if it doesn't exist
const fontsDir = path.join(process.cwd(), "fonts");
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
  console.log(`Created fonts directory at ${fontsDir}`);
}

// Download all fonts
async function downloadAllFonts() {
  // Copy default fonts first
  copyDefaultFonts();

  // Install woff2 if needed
  try {
    console.log("Checking for woff2 utility...");
    execSync("which woff2_decompress");
    console.log("woff2 utility found.");
  } catch (error) {
    console.error("woff2 utility not found. Please install it first.");
    console.log("On macOS: brew install woff2");
    console.log("On Ubuntu: sudo apt install woff2");
    process.exit(1);
  }

  for (const font of GOOGLE_FONTS) {
    for (const weight of font.weights) {
      await downloadFont(font.family, weight);
    }
  }

  console.log("All fonts downloaded successfully!");
}

// Download a specific font
async function downloadFont(fontFamily, fontWeight) {
  try {
    const normalizedFamily = fontFamily.replace(/\s+/g, "");
    const weightName = WEIGHT_NAMES[fontWeight];
    const outputPath = path.join(
      fontsDir,
      `${normalizedFamily}-${weightName}.ttf`
    );

    // Skip if font already exists
    if (fs.existsSync(outputPath)) {
      console.log(
        `Font ${fontFamily} (${fontWeight}) already exists at ${outputPath}`
      );
      return;
    }

    console.log(`Downloading ${fontFamily} (${fontWeight})...`);

    // 1. Get the CSS from Google Fonts
    const googleFontApiUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@${fontWeight}&display=swap`;
    const response = await axios.get(googleFontApiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    // 2. Extract the WOFF2 URL from the CSS
    const cssContent = response.data;
    const woff2Match = cssContent.match(/src:\s*url\(([^)]+\.woff2)\)/i);

    if (!woff2Match || !woff2Match[1]) {
      throw new Error(
        `Could not find font URL in CSS for ${fontFamily} (${fontWeight})`
      );
    }

    const woff2Url = woff2Match[1];
    console.log(`Found WOFF2 URL: ${woff2Url}`);

    // 3. Download the WOFF2 file
    const woff2Path = path.join(
      fontsDir,
      `${normalizedFamily}-${weightName}.woff2`
    );
    const fontResponse = await axios.get(woff2Url, {
      responseType: "arraybuffer",
    });

    fs.writeFileSync(woff2Path, Buffer.from(fontResponse.data));
    console.log(`Downloaded WOFF2 to ${woff2Path}`);

    // 4. Convert WOFF2 to TTF using woff2_decompress
    console.log(`Converting WOFF2 to TTF format...`);
    const woff2Dir = path.dirname(woff2Path);
    const woff2Name = path.basename(woff2Path);

    // Create a temporary raw TTF file (the decompressed woff2)
    const rawTtfPath = woff2Path.replace(".woff2", ".ttf");

    // Run woff2_decompress to convert WOFF2 to TTF
    execSync(`woff2_decompress "${woff2Path}"`, { cwd: woff2Dir });

    // Rename the file if needed
    if (fs.existsSync(rawTtfPath)) {
      fs.renameSync(rawTtfPath, outputPath);
      console.log(`Converted to TTF at ${outputPath}`);

      // Clean up the WOFF2 file
      fs.unlinkSync(woff2Path);
    } else {
      throw new Error(
        `Failed to convert WOFF2 to TTF for ${fontFamily} (${fontWeight})`
      );
    }

    console.log(
      `Successfully downloaded and converted ${fontFamily} (${fontWeight})`
    );
  } catch (error) {
    console.error(`Error downloading ${fontFamily} (${fontWeight}):`, error);
  }
}

// Add to download-fonts.js
function copyDefaultFonts() {
  const defaults = [
    {
      source: path.join(
        process.cwd(),
        "assets",
        "default-fonts",
        "Arial-Regular.ttf"
      ),
      dest: path.join(fontsDir, "Arial-Regular.ttf"),
    },
    {
      source: path.join(
        process.cwd(),
        "assets",
        "default-fonts",
        "Arial-Bold.ttf"
      ),
      dest: path.join(fontsDir, "Arial-Bold.ttf"),
    },
  ];

  for (const font of defaults) {
    if (fs.existsSync(font.source) && !fs.existsSync(font.dest)) {
      fs.copyFileSync(font.source, font.dest);
      console.log(`Copied default font from ${font.source} to ${font.dest}`);
    }
  }
}

// Run the download
downloadAllFonts().catch(console.error);
