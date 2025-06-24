const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Import the font metadata
const fontMetadataPath = path.join(process.cwd(), 'public', 'fonts', 'font-metadata.json');
let fontMetadata = [];

try {
  fontMetadata = JSON.parse(fs.readFileSync(fontMetadataPath, 'utf8'));
} catch (error) {
  console.error('Error reading font metadata:', error);
  process.exit(1);
}

// Weight mapping
const WEIGHT_TO_FILENAME = {
  '100': 'Thin',
  '200': 'ExtraLight', 
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
  '900': 'Black'
};

// License directories
const LICENSES = ['ofl', 'apache', 'ufl'];

/**
 * Normalize font family name to directory format
 */
function normalizeToDirectoryName(familyName) {
  return familyName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Generate possible GitHub URLs for a font
 */
function generatePossibleUrls(familyName, weight) {
  const normalizedName = normalizeToDirectoryName(familyName);
  const weightName = WEIGHT_TO_FILENAME[weight] || 'Regular';
  const filename = `${familyName}-${weightName}.ttf`;
  
  const urls = [];
  
  // Try each license directory
  for (const license of LICENSES) {
    // Regular path
    urls.push(`https://raw.githubusercontent.com/google/fonts/main/${license}/${normalizedName}/${filename}`);
    
    // With static subdirectory (for variable fonts)
    urls.push(`https://raw.githubusercontent.com/google/fonts/main/${license}/${normalizedName}/static/${filename}`);
  }
  
  return urls;
}

/**
 * Check if a URL exists
 */
async function checkUrl(url) {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Find working URL for a font
 */
async function findWorkingUrl(familyName, weight) {
  const possibleUrls = generatePossibleUrls(familyName, weight);
  
  for (const url of possibleUrls) {
    if (await checkUrl(url)) {
      return url;
    }
  }
  
  return null;
}

/**
 * Validate font URLs and create report
 */
async function validateFontUrls() {
  console.log('🔍 Validating font URLs from GitHub...\n');
  
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    workingUrls: {},
    failedFonts: []
  };
  
  // Test a subset of fonts to avoid rate limiting
  const testFonts = fontMetadata.slice(0, 20);
  
  for (const font of testFonts) {
    console.log(`Testing ${font.family}...`);
    
    for (const weight of font.weights) {
      results.total++;
      
      const workingUrl = await findWorkingUrl(font.family, weight);
      
      if (workingUrl) {
        results.successful++;
        if (!results.workingUrls[font.family]) {
          results.workingUrls[font.family] = {};
        }
        results.workingUrls[font.family][weight] = workingUrl;
        console.log(`  ✅ ${weight}: ${workingUrl}`);
      } else {
        results.failed++;
        results.failedFonts.push(`${font.family} (${weight})`);
        console.log(`  ❌ ${weight}: No working URL found`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n📊 Validation Results:');
  console.log(`Total font variants tested: ${results.total}`);
  console.log(`Successful: ${results.successful} (${((results.successful/results.total)*100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed} (${((results.failed/results.total)*100).toFixed(1)}%)`);
  
  if (results.failedFonts.length > 0) {
    console.log('\n❌ Failed fonts:');
    results.failedFonts.forEach(font => console.log(`  - ${font}`));
  }
  
  // Save results to file
  const resultsPath = path.join(process.cwd(), 'font-validation-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${resultsPath}`);
  
  return results;
}

/**
 * Generate updated font metadata with GitHub URLs
 */
async function generateUpdatedMetadata(validationResults) {
  const updatedMetadata = [];
  
  for (const font of fontMetadata) {
    const updatedFont = {
      ...font,
      githubFiles: {}
    };
    
    // Add GitHub URLs where available
    if (validationResults.workingUrls[font.family]) {
      updatedFont.githubFiles = validationResults.workingUrls[font.family];
    }
    
    updatedMetadata.push(updatedFont);
  }
  
  // Save updated metadata
  const updatedPath = path.join(process.cwd(), 'public', 'fonts', 'font-metadata-with-github.json');
  fs.writeFileSync(updatedPath, JSON.stringify(updatedMetadata, null, 2));
  console.log(`\n📄 Updated metadata saved to: ${updatedPath}`);
  
  return updatedMetadata;
}

/**
 * Main validation function
 */
async function main() {
  try {
    console.log('🚀 Starting font URL validation...\n');
    
    const validationResults = await validateFontUrls();
    
    if (validationResults.successful > 0) {
      await generateUpdatedMetadata(validationResults);
    }
    
    console.log('\n✅ Validation complete!');
    
    // Show examples of working URLs
    console.log('\n📋 Example working URLs:');
    const examples = Object.entries(validationResults.workingUrls).slice(0, 5);
    examples.forEach(([family, weights]) => {
      console.log(`\n${family}:`);
      Object.entries(weights).forEach(([weight, url]) => {
        console.log(`  ${weight}: ${url}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  main();
}

module.exports = {
  validateFontUrls,
  generatePossibleUrls,
  findWorkingUrl,
  checkUrl
};