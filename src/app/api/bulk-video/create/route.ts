import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseCSVFile, parseXLSXFile } from "@/app/utils/bulk-video/csv-parser";
import { GoogleSheetsImporter } from "@/app/utils/bulk-video/sheets-importer";
import { BulkVideoProjectSettings, BulkVideoData } from "@/app/types/bulk-video";

const bulkVideoSettingsSchema = z.object({
  brandLogoUrl: z.string(),
  logoPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']),
  logoSize: z.object({
    width: z.number().min(50).max(500),
    height: z.number().min(30).max(300),
  }),
  defaultVideoStyle: z.string(),
  defaultFormats: z.array(z.string()).min(1),
  defaultImageStyle: z.string(),
  defaultImageStylePreset: z.string().optional(),
  defaultAnimationProvider: z.enum(['runway', 'bytedance']),
  defaultDuration: z.number().min(5).max(60),
  defaultSceneCount: z.number().min(1).max(10),
  defaultCameraFixed: z.boolean().optional(),
  defaultUseEndImage: z.boolean().optional(),
  defaultAnimationPromptMode: z.enum(['ai', 'template']).optional(),
  defaultAnimationTemplate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { permissions: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check permissions
    const permission = user.permissions[0];
    if (!permission?.canCreateProjects) {
      return NextResponse.json(
        { error: "You don't have permission to create projects" },
        { status: 403 }
      );
    }

    // Check project limit
    const projectCount = await prisma.project.count({
      where: { userId: user.id },
    });

    if (projectCount >= permission.maxProjects) {
      return NextResponse.json(
        { error: `Project limit reached (${permission.maxProjects} projects)` },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const projectName = formData.get("projectName") as string;
    const projectDescription = formData.get("projectDescription") as string;
    const settingsJson = formData.get("settings") as string;
    const dataSourceType = formData.get("dataSourceType") as string;
    const dataFile = formData.get("dataFile") as File | null;
    const sheetsUrl = formData.get("sheetsUrl") as string | null;
    const videosJson = formData.get("videos") as string | null;

    if (!projectName) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    // Parse and validate settings
    let settings: BulkVideoProjectSettings;
    try {
      const parsedSettings = JSON.parse(settingsJson);
      console.log("[bulk-video/create] Parsed settings:", {
        ...parsedSettings,
        defaultAnimationPromptMode: parsedSettings.defaultAnimationPromptMode,
        defaultAnimationTemplate: parsedSettings.defaultAnimationTemplate,
      });
      settings = bulkVideoSettingsSchema.parse(parsedSettings);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid project settings" },
        { status: 400 }
      );
    }

    // Parse video data based on source type
    let videos: BulkVideoData[] = [];
    
    if (dataFile) {
      // Parse uploaded file
      const parseResult = dataFile.name.toLowerCase().endsWith('.csv')
        ? await parseCSVFile(dataFile)
        : await parseXLSXFile(dataFile);
      
      if (!parseResult.success || !parseResult.data) {
        return NextResponse.json(
          { error: parseResult.error || "Failed to parse file" },
          { status: 400 }
        );
      }
      
      videos = parseResult.data;
    } else if (sheetsUrl && dataSourceType === 'google-sheets') {
      // Extract spreadsheet ID from URL
      const spreadsheetId = GoogleSheetsImporter.extractSpreadsheetId(sheetsUrl);
      if (!spreadsheetId) {
        return NextResponse.json(
          { error: "Invalid Google Sheets URL" },
          { status: 400 }
        );
      }

      // For now, we'll use a simple public sheets approach
      // This requires the sheet to be publicly accessible
      try {
        // First try CSV export method (works without API key for public sheets)
        const csvExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        let rows: string[][] = [];
        
        try {
          const csvResponse = await fetch(csvExportUrl);
          if (csvResponse.ok) {
            const csvText = await csvResponse.text();
            
            // Parse CSV text into array format
            const lines = csvText.split('\n').filter(line => line.trim());
            rows = lines.map(line => {
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
          }
        } catch (csvError) {
          console.log("CSV export failed, trying Sheets API...");
        }

        // If CSV export failed, try with API key
        if (rows.length === 0) {
          const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
          if (!apiKey) {
            return NextResponse.json(
              { 
                error: "Unable to access Google Sheet. Please make sure it's publicly viewable (Anyone with the link can view) or use CSV/Excel upload instead." 
              },
              { status: 400 }
            );
          }

          // Fetch sheet data using public API
          const range = 'A:G'; // Columns A to G
          const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
          
          const response = await fetch(apiUrl);
          if (!response.ok) {
            if (response.status === 403) {
              return NextResponse.json(
                { error: "Google Sheet is not publicly accessible. Please make it viewable by anyone with the link." },
                { status: 400 }
              );
            }
            throw new Error(`Failed to fetch sheet: ${response.statusText}`);
          }

          const data = await response.json();
          rows = data.values || [];
        }

        if (rows.length < 2) {
          return NextResponse.json(
            { error: "Sheet must contain headers and at least one data row" },
            { status: 400 }
          );
        }

        // Parse the sheet data using our existing parser logic
        const { parseData } = await import("@/app/utils/bulk-video/csv-parser");
        const parseResult = parseData(rows, {
          textContent: 'text_content',
          productImage: 'product_image',
          imageStyle: 'image_style',
          videoFormats: 'video_formats',
          animationProvider: 'animation_provider',
          duration: 'duration',
          sceneCount: 'scene_count',
        });

        if (!parseResult.success || !parseResult.data) {
          return NextResponse.json(
            { error: parseResult.error || "Failed to parse sheet data" },
            { status: 400 }
          );
        }

        videos = parseResult.data;
      } catch (error) {
        console.error("Google Sheets import error:", error);
        return NextResponse.json(
          { error: "Failed to import from Google Sheets. Please ensure the sheet is publicly accessible." },
          { status: 500 }
        );
      }
    } else if (videosJson) {
      // Parse pre-processed videos data
      try {
        videos = JSON.parse(videosJson);
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid videos data" },
          { status: 400 }
        );
      }
    }

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found in data source" },
        { status: 400 }
      );
    }

    // Create project and bulk videos in a transaction
    const project = await prisma.$transaction(async (tx) => {
      // Create the project
      const newProject = await tx.project.create({
        data: {
          name: projectName,
          description: projectDescription,
          userId: user.id,
          projectType: "bulk-video",
          format: settings.defaultFormats[0], // Use first format as primary
          duration: settings.defaultDuration,
          
          // Bulk video specific fields
          brandLogoUrl: settings.brandLogoUrl,
          logoPosition: settings.logoPosition,
          logoWidth: settings.logoSize.width,
          logoHeight: settings.logoSize.height,
          defaultVideoStyle: settings.defaultVideoStyle,
          defaultFormats: settings.defaultFormats,
          defaultImageStyle: settings.defaultImageStyle,
          defaultImageStylePreset: settings.defaultImageStylePreset,
          defaultAnimationProvider: settings.defaultAnimationProvider,
          defaultDuration: settings.defaultDuration,
          defaultSceneCount: settings.defaultSceneCount,
          defaultCameraFixed: settings.defaultCameraFixed,
          defaultUseEndImage: settings.defaultUseEndImage,
          defaultAnimationPromptMode: settings.defaultAnimationPromptMode,
          defaultAnimationTemplate: settings.defaultAnimationTemplate,
          dataSourceType: dataSourceType,
          // TODO: Store file URL if uploaded
        },
      });

      // Create bulk video entries
      const bulkVideos = await Promise.all(
        videos.map((video, index) =>
          tx.bulkVideo.create({
            data: {
              projectId: newProject.id,
              userId: user.id,
              rowIndex: index + 1,
              textContent: video.textContent,
              productImageUrl: video.productImageUrl,
              customImageStyle: video.customImageStyle,
              customFormats: video.customFormats || [],
              customAnimationProvider: video.customAnimationProvider,
              customDuration: video.customDuration,
              customSceneCount: video.customSceneCount,
              customCameraFixed: video.customCameraFixed,
              customUseEndImage: video.customUseEndImage,
              customAnimationPromptMode: video.customAnimationPromptMode,
              customAnimationTemplate: video.customAnimationTemplate,
              status: "pending",
            },
          })
        )
      );

      return newProject;
    });

    // Start generation process (async)
    // Import the generator
    const { BulkVideoGenerator } = await import("@/app/utils/bulk-video/bulk-generator");
    const generator = new BulkVideoGenerator({
      concurrency: 3,
      onProgress: async (progress) => {
        console.log("Generation progress:", progress);
      },
    });

    // Don't await - let it run in background
    generator.generateBulkVideos(project.id).catch((error) => {
      console.error("Bulk generation error:", error);
    });
    
    return NextResponse.json({
      success: true,
      projectId: project.id,
      videoCount: videos.length,
      message: "Bulk video project created and generation started",
    });
  } catch (error) {
    console.error("Error creating bulk video project:", error);
    return NextResponse.json(
      { error: "Failed to create bulk video project" },
      { status: 500 }
    );
  }
}