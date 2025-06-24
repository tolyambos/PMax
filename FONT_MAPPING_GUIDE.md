# Google Fonts GitHub Repository Mapping Guide

This guide explains how to map font family names to their correct GitHub repository paths for Google Fonts, enabling reliable URLs for font downloads and usage.

## Overview

The Google Fonts repository on GitHub (https://github.com/google/fonts) contains thousands of font families organized by license type. This mapping system helps you:

1. Convert font family names to correct GitHub repository paths
2. Generate reliable URLs for font file downloads
3. Handle different license types (OFL, Apache, UFL)
4. Account for repository structure variations

## Repository Structure

Google Fonts are organized in the following directory structure:

```
google/fonts/
├── apache/          # Apache License fonts
│   ├── roboto/
│   └── opensans/
├── ofl/             # Open Font License fonts (most common)
│   ├── anton/
│   ├── arvo/
│   └── montserrat/
└── ufl/             # Ubuntu Font License fonts
    └── ubuntu/
```

## Usage Examples

### Basic Font URL Generation

```typescript
import { generateGitHubFontUrl } from './utils/google-fonts-mapping';

// Generate URL for Anton Regular
const antonUrl = generateGitHubFontUrl('Anton', '400');
// Returns: https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf

// Generate URL for Roboto Bold
const robotoBoldUrl = generateGitHubFontUrl('Roboto', '700');
// Returns: https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Bold.ttf
```

### Multiple Weights

```typescript
import { generateFontUrls } from './utils/google-fonts-mapping';

// Generate URLs for multiple weights
const barlowUrls = generateFontUrls('Barlow', ['300', '400', '600', '700']);
// Returns:
// {
//   '300': 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/Barlow-Light.ttf',
//   '400': 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/Barlow-Regular.ttf',
//   '600': 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/Barlow-SemiBold.ttf',
//   '700': 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/Barlow-Bold.ttf'
// }
```

### Finding Working URLs

```typescript
import { findWorkingFontUrl } from './utils/google-fonts-mapping';

// Find a working URL (with validation)
const workingUrl = await findWorkingFontUrl('Poppins', '500');
// Returns the first working URL or null if none found
```

### Repository Path Mapping

```typescript
import { getFontRepoPath } from './utils/google-fonts-mapping';

// Get repository path information
const repoPath = getFontRepoPath('Montserrat');
// Returns:
// {
//   license: 'ofl',
//   directory: 'montserrat',
//   fullPath: 'ofl/montserrat'
// }
```

## Font Name Mapping

The system includes mappings for common fonts:

| Font Family | GitHub Directory | License | Example URL |
|-------------|------------------|---------|-------------|
| AlfaSlabOne | `ofl/alfaslabone` | OFL | `.../ofl/alfaslabone/AlfaSlabOne-Regular.ttf` |
| Anton | `ofl/anton` | OFL | `.../ofl/anton/Anton-Regular.ttf` |
| Arvo | `ofl/arvo` | OFL | `.../ofl/arvo/Arvo-Regular.ttf` |
| Barlow | `ofl/barlow` | OFL | `.../ofl/barlow/Barlow-Regular.ttf` |
| Montserrat | `ofl/montserrat` | OFL | `.../ofl/montserrat/Montserrat-Regular.ttf` |
| OpenSans | `apache/opensans` | Apache | `.../apache/opensans/OpenSans-Regular.ttf` |
| Poppins | `ofl/poppins` | OFL | `.../ofl/poppins/Poppins-Regular.ttf` |
| Roboto | `apache/roboto` | Apache | `.../apache/roboto/Roboto-Regular.ttf` |

## Weight Mapping

Font weights are mapped to filename conventions:

| Weight | Name | Example |
|--------|------|---------|
| 100 | Thin | `FontName-Thin.ttf` |
| 200 | ExtraLight | `FontName-ExtraLight.ttf` |
| 300 | Light | `FontName-Light.ttf` |
| 400 | Regular | `FontName-Regular.ttf` |
| 500 | Medium | `FontName-Medium.ttf` |
| 600 | SemiBold | `FontName-SemiBold.ttf` |
| 700 | Bold | `FontName-Bold.ttf` |
| 800 | ExtraBold | `FontName-ExtraBold.ttf` |
| 900 | Black | `FontName-Black.ttf` |

## Integration with Existing Code

### Client-Side Integration

The font mapping automatically integrates with your existing font loading:

```typescript
// In your existing fonts.ts
import { generateGitHubFontUrl } from './google-fonts-mapping';

// The getFontUrl function now uses GitHub URLs in production
const fontUrl = await getFontUrl('Anton', '400');
// Returns GitHub URL when in production, local path in development
```

### Server-Side Integration

Server-side font utilities also support GitHub URLs:

```typescript
// In your server-side code
import { getFontUrl } from './fonts-server';

const fontUrl = getFontUrl('Roboto', '700');
// Returns GitHub URL when in production
```

## Validation and Testing

### Validate URLs

```bash
# Run the validation script
node scripts/validate-font-urls.js
```

This script will:
1. Test URLs for your font metadata
2. Generate a validation report
3. Create updated metadata with working GitHub URLs

### Test the Mapping

```typescript
// Run tests
import { runAllTests } from './utils/test-font-mapping';

await runAllTests();
```

## Advanced Usage

### URL Variations

For fonts that might have different path structures:

```typescript
import { getFontUrlVariations } from './utils/google-fonts-mapping';

// Get all possible URL variations
const variations = getFontUrlVariations('FontName', '400');
// Returns array of possible URLs to try
```

### Metadata Updates

Update your existing font metadata with GitHub URLs:

```typescript
import { updateFontMetadataWithGitHubUrls } from './utils/google-fonts-mapping';

const updatedMetadata = updateFontMetadataWithGitHubUrls(currentMetadata);
// Returns metadata with GitHub URLs added
```

### Custom Mapping

Add custom font mappings by updating the `FONT_FAMILY_TO_REPO_PATH` object:

```typescript
export const FONT_FAMILY_TO_REPO_PATH = {
  // ... existing mappings
  'CustomFont': { 
    license: 'OFL', 
    directory: 'customfont',
    alternativeNames: ['Custom Font', 'Custom-Font']
  }
};
```

## Error Handling

The system includes comprehensive error handling:

1. **Fallback URLs**: If the primary GitHub URL fails, falls back to local paths
2. **Alternative Names**: Supports multiple name variations for the same font
3. **License Detection**: Automatically tries different license directories
4. **Validation**: Includes URL validation before usage

## Common Issues and Solutions

### Font Not Found

If a font mapping is not found:
1. Check if the font name matches exactly
2. Try alternative spellings or names
3. Add a custom mapping for the font
4. Use the fallback directory inference

### URL Not Working

If a generated URL doesn't work:
1. Use `findWorkingFontUrl()` to find alternatives
2. Check if the font exists in the Google Fonts repository
3. Verify the license directory (OFL vs Apache vs UFL)
4. Check if the font has a `static/` subdirectory

### Performance Considerations

1. **Caching**: URLs are cached to avoid repeated generation
2. **Batch Validation**: Validate multiple URLs in batches
3. **Rate Limiting**: Include delays when validating many URLs
4. **Fallbacks**: Always have local font fallbacks

## Files Created

This font mapping system includes:

1. **`google-fonts-mapping.ts`**: Core mapping utility
2. **`test-font-mapping.ts`**: Testing and validation utilities
3. **`validate-font-urls.js`**: URL validation script
4. **Updated `fonts.ts`**: Client-side integration
5. **Updated `fonts-server.ts`**: Server-side integration

## Example URLs

Here are example URLs for common fonts:

- **Anton**: `https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf`
- **Arvo Bold**: `https://raw.githubusercontent.com/google/fonts/main/ofl/arvo/Arvo-Bold.ttf`
- **Roboto**: `https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf`
- **Montserrat Medium**: `https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat-Medium.ttf`

## Next Steps

1. Run the validation script to test your current fonts
2. Update your font metadata with GitHub URLs
3. Test the integration in your development environment
4. Deploy with production GitHub URL support
5. Monitor for any font loading issues and add fallbacks as needed