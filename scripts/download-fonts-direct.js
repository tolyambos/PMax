const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");

// Font definitions - keep this in sync with your app's font list
const GOOGLE_FONTS = [
  {
    family: "Roboto",
    weights: ["Light", "Regular", "Medium", "Bold"],
    repo: "apache/roboto/static",
  },
  {
    family: "OpenSans",
    weights: ["Light", "Regular", "SemiBold", "Bold"],
    repo: "apache/opensans/static/OpenSans",
  },
  {
    family: "Montserrat",
    weights: ["Light", "Regular", "Medium", "Bold", "ExtraBold"],
    repo: "ofl/montserrat/static",
  },
  {
    family: "Lato",
    weights: ["Light", "Regular", "Bold", "Black"],
    repo: "ofl/lato",
  },
  {
    family: "Poppins",
    weights: ["Light", "Regular", "Medium", "SemiBold", "Bold"],
    repo: "ofl/poppins",
  },
  {
    family: "Raleway",
    weights: ["Light", "Regular", "Medium", "SemiBold", "Bold"],
    repo: "ofl/raleway/static",
  },
  {
    family: "Oswald",
    weights: ["Light", "Regular", "Medium", "SemiBold", "Bold"],
    repo: "ofl/oswald/static",
  },
  {
    family: "PlayfairDisplay",
    weights: ["Regular", "Medium", "SemiBold", "Bold", "ExtraBold"],
    repo: "ofl/playfairdisplay/static",
  },
  {
    family: "Merriweather",
    weights: ["Light", "Regular", "Bold", "Black"],
    repo: "ofl/merriweather",
  },
  {
    family: "SourceSansPro",
    weights: ["Light", "Regular", "SemiBold", "Bold"],
    repo: "ofl/sourcesanspro",
  },
];

// Create fonts directory if it doesn't exist
const fontsDir = path.join(process.cwd(), "fonts");
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
  console.log(`Created fonts directory at ${fontsDir}`);
} else {
  console.log(`Found existing fonts directory at ${fontsDir}`);
}

// Function to download a font file
async function downloadFile(url, outputPath) {
  try {
    console.log(`Downloading from: ${url}`);

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent: new https.Agent({ keepAlive: true }),
    });

    fs.writeFileSync(outputPath, Buffer.from(response.data));
    const stats = fs.statSync(outputPath);
    console.log(`Downloaded to ${outputPath} (${stats.size} bytes)`);

    if (stats.size < 100000) {
      console.warn(
        `WARNING: Font file seems unusually small (${stats.size} bytes). Please verify the file contents.`
      );
    }

    return true;
  } catch (error) {
    console.error(`Error downloading from ${url}: ${error.message}`);
    return false;
  }
}

// Main function to download all fonts
async function downloadAllFonts() {
  console.log("Starting font download process...");

  let successCount = 0;
  let failureCount = 0;

  for (const font of GOOGLE_FONTS) {
    console.log(`\nProcessing font family: ${font.family}`);

    for (const weight of font.weights) {
      const fontFilename = `${font.family}-${weight}.ttf`;
      const outputPath = path.join(fontsDir, fontFilename);

      // Skip if font already exists and is a valid size
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 100000) {
          console.log(
            `Font ${fontFilename} already exists with adequate size (${stats.size} bytes). Skipping.`
          );
          successCount++;
          continue;
        } else {
          console.log(
            `Font ${fontFilename} exists but seems too small (${stats.size} bytes). Re-downloading.`
          );
          // Backup the existing file just in case
          fs.renameSync(outputPath, `${outputPath}.bak`);
        }
      }

      const url = `https://github.com/google/fonts/raw/main/${font.repo}/${font.family}-${weight}.ttf`;
      const success = await downloadFile(url, outputPath);

      if (success) {
        successCount++;
      } else {
        failureCount++;
        console.log(`Trying alternative URL format...`);
        const altUrl = `https://github.com/google/fonts/raw/main/${font.repo}/${font.family.replace(/([A-Z])/g, " $1").trim()}-${weight}.ttf`;
        const altSuccess = await downloadFile(altUrl, outputPath);

        if (altSuccess) {
          console.log(`Alternative URL succeeded!`);
          successCount++;
          failureCount--;
        }
      }
    }
  }

  console.log("\n========== Download Summary ==========");
  console.log(`Total fonts processed: ${successCount + failureCount}`);
  console.log(`Successfully downloaded: ${successCount}`);
  console.log(`Failed to download: ${failureCount}`);

  if (failureCount > 0) {
    console.log(
      "\nSome fonts failed to download. You may need to manually download them or check the URLs."
    );
    return false;
  } else {
    console.log("\nAll fonts downloaded successfully!");
    return true;
  }
}

// Run the download
downloadAllFonts()
  .then((success) => {
    if (success) {
      console.log("Font setup complete!");
    } else {
      console.error("Font setup completed with errors.");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("Font setup failed:", error);
    process.exit(1);
  });
