import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";

// POST /api/bulk-video/debug-download - Debug what's in the downloaded file
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Generate presigned URL
    const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(url);
    const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);

    // Try to download first 1KB to see what's in it
    const response = await fetch(presignedUrl, {
      headers: {
        "Range": "bytes=0-1023",
      },
    });

    const text = await response.text();
    
    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        contentRange: response.headers.get("content-range"),
        acceptRanges: response.headers.get("accept-ranges"),
      },
      firstKB: text.substring(0, 1000),
      isXML: text.includes("<?xml"),
      isHTML: text.includes("<html"),
      presignedUrlSample: presignedUrl.substring(0, 200) + "...",
    });
  } catch (error) {
    console.error("Debug download error:", error);
    return NextResponse.json(
      { 
        error: "Failed to debug download",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}