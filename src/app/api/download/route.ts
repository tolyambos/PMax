import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { s3Utils } from "@/lib/s3-utils";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    console.log(`Download request for path: ${filePath}`);

    // Check if this is an S3 URL
    if (filePath.includes("s3.eu-central-1.wasabisys.com")) {
      try {
        // Extract bucket and key from S3 URL
        const { bucket, bucketKey } =
          s3Utils.extractBucketAndKeyFromUrl(filePath);

        console.log(`Downloading S3 asset: ${bucket}/${bucketKey}`);

        // Generate a presigned URL for download
        const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);

        console.log(`Generated presigned URL for download`);

        // Fetch the file from S3 using the presigned URL
        const s3Response = await fetch(presignedUrl);

        if (!s3Response.ok) {
          throw new Error(`Failed to fetch from S3: ${s3Response.statusText}`);
        }

        // Get the file content
        const fileBuffer = await s3Response.arrayBuffer();

        // Determine content type based on file extension
        const contentType = getContentTypeFromUrl(filePath);

        // Get filename from the URL
        const filename = getFilenameFromUrl(filePath);

        console.log(`Serving S3 file: ${filename} (${contentType})`);

        // Return the file with appropriate headers
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-cache",
          },
        });
      } catch (s3Error) {
        console.error("Error downloading from S3:", s3Error);
        return NextResponse.json(
          { error: "Failed to download file from S3" },
          { status: 500 }
        );
      }
    } else {
      // Handle local file system paths (original logic)
      // Validate path to prevent directory traversal attacks
      const normalizedPath = path
        .normalize(filePath)
        .replace(/^(\.\.(\/|\\|$))+/, "");

      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // Read file
      const fileBuffer = fs.readFileSync(normalizedPath);

      // Determine content type
      const contentType = getContentTypeFromPath(normalizedPath);
      const filename = path.basename(normalizedPath);

      console.log(`Serving local file: ${filename} (${contentType})`);

      // Create Response object
      const response = new NextResponse(fileBuffer);

      // Set headers
      response.headers.set("Content-Type", contentType);
      response.headers.set(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Clean up file after sending (optional)
      // Consider whether you want to remove the file after downloading
      // fs.unlinkSync(normalizedPath);

      return response;
    }
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}

// Helper function to determine content type from URL
function getContentTypeFromUrl(url: string): string {
  const ext = url.toLowerCase().split(".").pop();
  return getContentTypeFromExtension(ext || "");
}

// Helper function to determine content type from file path
function getContentTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  return getContentTypeFromExtension(ext);
}

// Helper function to get content type from extension
function getContentTypeFromExtension(ext: string): string {
  const contentTypes: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return contentTypes[ext] || "application/octet-stream";
}

// Helper function to extract filename from URL
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "download";

    // Remove any query parameters from filename
    return filename.split("?")[0];
  } catch {
    return "download";
  }
}
