// ensure-fonts.ts
// This module ensures fonts are available for video rendering by downloading them if needed

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'files');
const FONT_METADATA_PATH = path.join(process.cwd(), 'public', 'fonts', 'font-metadata.json');

interface FontMetadata {
  family: string;
  weights: string[];
  files: Record<string, string>;
}

/**
 * Downloads a font file from GitHub LFS
 */
async function downloadFont(fileName: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const githubUrl = `https://media.githubusercontent.com/media/tolyambos/PMax/main/fonts/${fileName}`;
    console.log(`[FONT-DOWNLOAD] Downloading ${fileName} from GitHub...`);

    const file = fs.createWriteStream(outputPath);
    
    function makeRequest(url: string, redirectCount = 0): void {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }

      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.get(url, (response) => {
        // Handle redirects
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, url).href;
          makeRequest(redirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          const stats = fs.statSync(outputPath);
          console.log(`[FONT-DOWNLOAD] Downloaded ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Delete partial file
          reject(err);
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    }

    makeRequest(githubUrl);
  });
}

/**
 * Ensures a font file exists and is valid (not a Git LFS pointer)
 */
async function ensureFontFile(fileName: string): Promise<string> {
  const filePath = path.join(FONTS_DIR, fileName);
  
  // Check if file exists
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    
    // Check if it's a real font file (not Git LFS pointer)
    if (stats.size > 1000) {
      // Read first few bytes to verify it's not a Git LFS pointer
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(50);
      fs.readSync(fd, buffer, 0, 50, 0);
      fs.closeSync(fd);
      
      const firstBytes = buffer.toString('utf8');
      if (!firstBytes.includes('version https://git-lfs')) {
        // It's a real font file
        return filePath;
      }
      
      console.log(`[FONT-ENSURE] ${fileName} is a Git LFS pointer, re-downloading...`);
    } else {
      console.log(`[FONT-ENSURE] ${fileName} is too small (${stats.size} bytes), re-downloading...`);
    }
  }

  // Download the font
  try {
    await downloadFont(fileName, filePath);
    return filePath;
  } catch (error) {
    console.error(`[FONT-ENSURE] Failed to download ${fileName}:`, error);
    throw error;
  }
}

/**
 * Ensures a font is available for video rendering
 */
export async function ensureFontForRendering(fontFamily: string, weight: string = '400'): Promise<string | null> {
  try {
    // Ensure fonts directory exists
    if (!fs.existsSync(FONTS_DIR)) {
      fs.mkdirSync(FONTS_DIR, { recursive: true });
    }

    // Load font metadata
    if (!fs.existsSync(FONT_METADATA_PATH)) {
      console.error('[FONT-ENSURE] Font metadata not found');
      return null;
    }

    const metadata: FontMetadata[] = JSON.parse(fs.readFileSync(FONT_METADATA_PATH, 'utf8'));
    
    // Find the font in metadata
    const fontMeta = metadata.find(f => f.family === fontFamily);
    if (!fontMeta) {
      console.log(`[FONT-ENSURE] Font ${fontFamily} not found in metadata`);
      return null;
    }

    // Get the file path for the requested weight
    let fontPath = fontMeta.files[weight];
    
    // If exact weight not found, use first available weight
    if (!fontPath && Object.keys(fontMeta.files).length > 0) {
      const fallbackWeight = Object.keys(fontMeta.files)[0];
      fontPath = fontMeta.files[fallbackWeight];
      console.log(`[FONT-ENSURE] Using fallback weight ${fallbackWeight} for ${fontFamily}`);
    }

    if (!fontPath) {
      console.log(`[FONT-ENSURE] No font files found for ${fontFamily}`);
      return null;
    }

    // Extract filename from path
    const fileName = fontPath.split('/').pop();
    if (!fileName) {
      console.error('[FONT-ENSURE] Invalid font path in metadata');
      return null;
    }

    // Ensure the font file exists and is valid
    const filePath = await ensureFontFile(fileName);
    return filePath;
  } catch (error) {
    console.error(`[FONT-ENSURE] Error ensuring font ${fontFamily}:`, error);
    return null;
  }
}

/**
 * Preload all fonts from metadata to ensure they're available
 */
export async function preloadAllFonts(): Promise<void> {
  try {
    if (!fs.existsSync(FONT_METADATA_PATH)) {
      console.error('[FONT-ENSURE] Font metadata not found for preloading');
      return;
    }

    const metadata: FontMetadata[] = JSON.parse(fs.readFileSync(FONT_METADATA_PATH, 'utf8'));
    
    console.log(`[FONT-ENSURE] Preloading ${metadata.length} font families...`);
    
    for (const font of metadata) {
      for (const [weight, fontPath] of Object.entries(font.files)) {
        const fileName = fontPath.split('/').pop();
        if (fileName) {
          try {
            await ensureFontFile(fileName);
          } catch (error) {
            console.error(`[FONT-ENSURE] Failed to preload ${fileName}:`, error);
          }
        }
      }
    }
    
    console.log('[FONT-ENSURE] Font preloading complete');
  } catch (error) {
    console.error('[FONT-ENSURE] Error preloading fonts:', error);
  }
}