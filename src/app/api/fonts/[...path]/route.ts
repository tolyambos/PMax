import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const fontPath = params.path.join("/");
    let fileContent: Buffer;

    // Always try local files first, then fall back to GitHub if needed
    const fullPath = path.join(process.cwd(), "public", "fonts", fontPath);
    
    // Security check - prevent directory traversal
    const normalizedPath = path.normalize(fullPath);
    const publicFontsDir = path.join(process.cwd(), "public", "fonts");
    if (!normalizedPath.startsWith(publicFontsDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Try to read local file first
    try {
      await fs.access(fullPath);
      fileContent = await fs.readFile(fullPath);
      console.log(`[FONT-API] Served local font: ${fontPath}`);
    } catch (localError) {
      // If local file doesn't exist and we're in production, try GitHub
      if (process.env.NODE_ENV === "production") {
        const fileName = fontPath.split("/").pop();
        if (!fileName) {
          return new NextResponse("Invalid font path", { status: 400 });
        }

        console.log(`[FONT-API] Local font not found, fetching from GitHub: ${fileName}`);

        try {
          const githubUrl = `https://github.com/tolyambos/PMax/raw/main/fonts/${fileName}`;
          const response = await fetch(githubUrl);

          if (!response.ok) {
            console.error(
              `[FONT-API] GitHub fetch failed: ${response.status} ${response.statusText}`
            );
            return new NextResponse("Font not found on GitHub", { status: 404 });
          }

          const arrayBuffer = await response.arrayBuffer();
          fileContent = Buffer.from(arrayBuffer);
          console.log(
            `[FONT-API] Successfully fetched ${fileName} from GitHub (${fileContent.length} bytes)`
          );
        } catch (error) {
          console.error(`[FONT-API] Error fetching font from GitHub:`, error);
          return new NextResponse("Error fetching font from GitHub", {
            status: 500,
          });
        }
      } else {
        // Development mode and file not found
        return new NextResponse("Font not found", { status: 404 });
      }
    }

    // Determine content type based on extension
    const ext = path.extname(fontPath).toLowerCase();
    let contentType = "application/octet-stream";

    switch (ext) {
      case ".ttf":
        contentType = "font/ttf";
        break;
      case ".otf":
        contentType = "font/otf";
        break;
      case ".woff":
        contentType = "font/woff";
        break;
      case ".woff2":
        contentType = "font/woff2";
        break;
    }

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Content-Length": fileContent.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving font:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
