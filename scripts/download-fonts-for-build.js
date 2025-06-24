const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Read font metadata to get list of fonts to download
const fontMetadataPath = path.join(
  process.cwd(),
  "public",
  "fonts",
  "font-metadata.json"
);
const outputDir = path.join(process.cwd(), "public", "fonts", "files");

console.log("📦 Downloading fonts for production build...");

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);

    function makeRequest(currentUrl, redirectCount = 0) {
      if (redirectCount > 10) {
        reject(new Error(`Too many redirects (${redirectCount})`));
        return;
      }

      const urlObj = new URL(currentUrl);
      const client = urlObj.protocol === "https:" ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PMax-Font-Downloader/1.0)",
          Accept: "*/*",
          "Accept-Encoding": "identity",
        },
        timeout: 30000, // 30 second timeout
      };

      console.log(`  → Requesting: ${currentUrl}`);

      const req = client.request(options, (response) => {
        console.log(
          `  → Response: ${response.statusCode} ${response.statusMessage}`
        );

        // Handle redirects
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error(`Redirect without location header`));
            return;
          }

          // Resolve relative URLs
          const absoluteRedirectUrl = new URL(redirectUrl, currentUrl).href;
          console.log(`  → Redirected to: ${absoluteRedirectUrl}`);

          file.destroy(); // Clean up current stream
          makeRequest(absoluteRedirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
          );
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });

        file.on("error", (err) => {
          fs.unlink(outputPath, () => {}); // Delete partial file
          reject(err);
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("timeout", () => {
        req.abort();
        reject(new Error("Request timeout"));
      });

      req.end();
    }

    makeRequest(url);
  });
}

async function downloadFonts() {
  try {
    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Read font metadata
    const fontMetadata = JSON.parse(fs.readFileSync(fontMetadataPath, "utf8"));

    let downloadCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const font of fontMetadata) {
      for (const [weight, localPath] of Object.entries(font.files)) {
        const fileName = localPath.split("/").pop();
        const outputPath = path.join(outputDir, fileName);

        // Skip if file already exists
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 1000) {
            // File exists and is not empty
            console.log(`⏭️  Skipping ${fileName} (already exists)`);
            skipCount++;
            continue;
          }
        }

        try {
          const githubUrl = `https://github.com/tolyambos/PMax/raw/main/fonts/${fileName}`;
          console.log(`⬇️  Downloading ${fileName}...`);

          await downloadFile(githubUrl, outputPath);

          const stats = fs.statSync(outputPath);
          console.log(
            `✅ Downloaded ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`
          );
          downloadCount++;

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Failed to download ${fileName}:`, error.message);
          failCount++;
        }
      }
    }

    console.log("\n📊 Download Summary:");
    console.log(`✅ Downloaded: ${downloadCount} fonts`);
    console.log(`⏭️  Skipped: ${skipCount} fonts (already existed)`);
    console.log(`❌ Failed: ${failCount} fonts`);

    if (failCount > 0) {
      console.log(
        "\n⚠️  Some fonts failed to download. The app will fall back to GitHub fetching for missing fonts."
      );
    } else if (downloadCount + skipCount > 0) {
      console.log("\n🎉 All fonts are ready for production!");
    }
  } catch (error) {
    console.error("💥 Error during font download:", error);
    process.exit(1);
  }
}

// Allow disabling font download via environment variable
if (process.env.SKIP_FONT_DOWNLOAD === "true") {
  console.log("⏭️  Skipping font download (SKIP_FONT_DOWNLOAD=true)");
  console.log("   Fonts will be fetched from GitHub at runtime");
  process.exit(0);
}

// Run only if NODE_ENV is production or if explicitly requested
if (process.env.NODE_ENV === "production" || process.argv.includes("--force")) {
  downloadFonts().catch((error) => {
    console.error("💥 Font download failed:", error.message);
    console.log(
      "⚠️  Continuing build - fonts will be fetched from GitHub at runtime"
    );
    // Don't exit with error to allow build to continue
    process.exit(0);
  });
} else {
  console.log("🔧 Skipping font download (not in production mode)");
  console.log("   Run with --force to download anyway");
}
