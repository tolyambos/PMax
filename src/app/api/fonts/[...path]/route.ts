import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const fontPath = params.path.join("/");
    const fullPath = path.join(process.cwd(), "public", "fonts", fontPath);

    // Security check - prevent directory traversal
    const normalizedPath = path.normalize(fullPath);
    const publicFontsDir = path.join(process.cwd(), "public", "fonts");
    if (!normalizedPath.startsWith(publicFontsDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Read the font file
    const fileContent = await fs.readFile(fullPath);

    // Determine content type based on extension
    const ext = path.extname(fullPath).toLowerCase();
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
