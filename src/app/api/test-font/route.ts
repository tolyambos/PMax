import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "files",
      "Anton-Regular.ttf"
    );

    // Check if file exists
    try {
      await fs.access(fontPath);
    } catch {
      return NextResponse.json(
        { error: "Font file not found" },
        { status: 404 }
      );
    }

    // Read file info
    const stats = await fs.stat(fontPath);
    const fileContent = await fs.readFile(fontPath);

    // Check first few bytes to verify it's a font file
    const header = fileContent.slice(0, 4);
    const sfntVersion = header.readUInt32BE(0);

    return NextResponse.json({
      exists: true,
      size: stats.size,
      path: fontPath,
      headerBytes: Array.from(header),
      sfntVersion: sfntVersion.toString(16),
      isValidTTF: sfntVersion === 0x00010000 || sfntVersion === 0x74727565,
      isValidOTF: sfntVersion === 0x4f54544f,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        cwd: process.cwd(),
      },
      { status: 500 }
    );
  }
}
