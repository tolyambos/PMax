import { NextRequest, NextResponse } from "next/server";
import { parseData } from "@/app/utils/bulk-video/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const { sheetsUrl, spreadsheetId } = await request.json();

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Invalid Google Sheets URL" },
        { status: 400 }
      );
    }

    // For public sheets, we can try to fetch without API key first
    // This uses the CSV export feature which doesn't require authentication for public sheets
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    
    try {
      // First try CSV export (works for public sheets without API key)
      const response = await fetch(csvExportUrl);
      
      if (response.ok) {
        const csvText = await response.text();
        
        // Parse CSV text into array format
        const lines = csvText.split('\n').filter(line => line.trim());
        const rows = lines.map(line => {
          // Simple CSV parsing (handles basic cases)
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        });

        // Parse using our existing parser
        const parseResult = parseData(rows, {
          textContent: 'text_content',
          productImage: 'product_image',
          imageStyle: 'image_style',
          videoFormats: 'video_formats',
          animationProvider: 'animation_provider',
          duration: 'duration',
          sceneCount: 'scene_count',
        });

        return NextResponse.json(parseResult);
      }
    } catch (csvError) {
      console.log("CSV export failed, trying Sheets API...");
    }

    // If CSV export fails, try with Google Sheets API
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: "Unable to access sheet. Please make sure it's publicly viewable or use CSV/Excel upload instead.",
          success: false
        },
        { status: 400 }
      );
    }

    // Fetch sheet data using Sheets API
    const range = 'A:G';
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          { 
            error: "Google Sheet is not publicly accessible. Please go to Share > Anyone with the link > Viewer.",
            success: false
          },
          { status: 400 }
        );
      }
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return NextResponse.json(
        { 
          error: "Sheet must contain headers and at least one data row",
          success: false
        },
        { status: 400 }
      );
    }

    // Parse the sheet data
    const parseResult = parseData(rows, {
      textContent: 'text_content',
      productImage: 'product_image',
      imageStyle: 'image_style',
      videoFormats: 'video_formats',
      animationProvider: 'animation_provider',
      duration: 'duration',
      sceneCount: 'scene_count',
    });

    return NextResponse.json(parseResult);
  } catch (error) {
    console.error("Google Sheets preview error:", error);
    return NextResponse.json(
      { 
        error: "Failed to preview Google Sheet. Please ensure it's publicly accessible.",
        success: false
      },
      { status: 500 }
    );
  }
}