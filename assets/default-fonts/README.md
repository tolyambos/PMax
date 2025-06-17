# Default Fonts

This directory should contain fallback font files that are included with your repository.
Due to licensing restrictions, you should manually add the following fonts to this directory:

- Arial-Regular.ttf
- Arial-Bold.ttf

You can typically find these fonts in your system's fonts directory or download them from a trusted source.

## Font Locations by Operating System

### Windows
- C:\Windows\Fonts\

### macOS
- /System/Library/Fonts/
- /Library/Fonts/

### Linux
- /usr/share/fonts/
- ~/.local/share/fonts/

After adding the fonts, run `npm run setup-fonts` to set up all required fonts for the application.
