import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";

export async function POST(request: NextRequest) {
  try {
    // Get user ID - in development we use a dev user ID
    let userId: string;

    if (process.env.NODE_ENV === "development") {
      userId = "dev-user-id";
    } else {
      const authResult = auth();
      if (!authResult.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = authResult.userId;
    }

    const { url, ownerId, forDownload } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Extract bucket and key from the URL
    const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(url);

    // Generate presigned URL with optional download headers
    const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, forDownload || false);

    return NextResponse.json({ url: presignedUrl });
  } catch (error) {
    console.error("Error refreshing presigned URL:", error);

    if (error instanceof Error) {
      if (error.message.includes("Asset not found")) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      if (error.message.includes("403")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Failed to refresh presigned URL" },
      { status: 500 }
    );
  }
}
