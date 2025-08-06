import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";

// GET /api/bulk-video/test-url?url=... - Test if a video URL is accessible
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const videoUrl = searchParams.get("url");

    if (!videoUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Generate presigned URL
    const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(videoUrl);
    const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);

    // Try to fetch just the headers
    const headResponse = await fetch(presignedUrl, { method: "HEAD" });
    
    const responseInfo: any = {
      url: videoUrl,
      presignedUrl: presignedUrl.substring(0, 100) + "...",
      status: headResponse.status,
      statusText: headResponse.statusText,
      headers: {
        contentLength: headResponse.headers.get("content-length"),
        contentType: headResponse.headers.get("content-type"),
        etag: headResponse.headers.get("etag"),
        lastModified: headResponse.headers.get("last-modified"),
      },
      canAccess: headResponse.ok,
    };

    // If HEAD request fails, try GET with range header
    if (!headResponse.ok) {
      const rangeResponse = await fetch(presignedUrl, {
        headers: {
          "Range": "bytes=0-1023", // Just get first 1KB
        },
      });
      
      responseInfo.rangeTest = {
        status: rangeResponse.status,
        statusText: rangeResponse.statusText,
        contentLength: rangeResponse.headers.get("content-length"),
        contentRange: rangeResponse.headers.get("content-range"),
      };
    }

    return NextResponse.json(responseInfo);
  } catch (error) {
    console.error("Error testing URL:", error);
    return NextResponse.json(
      { 
        error: "Failed to test URL",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}