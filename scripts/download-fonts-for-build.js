const fs = require('fs');
const path = require('path');
const https = require('https');

// Read font metadata to get list of fonts to download
const fontMetadataPath = path.join(process.cwd(), 'public', 'fonts', 'font-metadata.json');
const outputDir = path.join(process.cwd(), 'public', 'fonts', 'files');

console.log('📦 Downloading fonts for production build...');

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function downloadFonts() {
  try {
    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Read font metadata
    const fontMetadata = JSON.parse(fs.readFileSync(fontMetadataPath, 'utf8'));
    
    let downloadCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const font of fontMetadata) {
      for (const [weight, localPath] of Object.entries(font.files)) {
        const fileName = localPath.split('/').pop();
        const outputPath = path.join(outputDir, fileName);
        
        // Skip if file already exists
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 1000) { // File exists and is not empty
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
          console.log(`✅ Downloaded ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
          downloadCount++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Failed to download ${fileName}:`, error.message);
          failCount++;
        }
      }
    }
    
    console.log('\n📊 Download Summary:');
    console.log(`✅ Downloaded: ${downloadCount} fonts`);
    console.log(`⏭️  Skipped: ${skipCount} fonts (already existed)`);
    console.log(`❌ Failed: ${failCount} fonts`);
    
    if (failCount > 0) {
      console.log('\n⚠️  Some fonts failed to download. The app will fall back to GitHub fetching for missing fonts.');
    } else if (downloadCount + skipCount > 0) {
      console.log('\n🎉 All fonts are ready for production!');
    }
    
  } catch (error) {
    console.error('💥 Error during font download:', error);
    process.exit(1);
  }
}

// Run only if NODE_ENV is production or if explicitly requested
if (process.env.NODE_ENV === 'production' || process.argv.includes('--force')) {
  downloadFonts();
} else {
  console.log('🔧 Skipping font download (not in production mode)');
  console.log('   Run with --force to download anyway');
}