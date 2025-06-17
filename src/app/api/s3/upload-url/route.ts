import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType, assetType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Filename and contentType are required" },
        { status: 400 }
      );
    }

    // Determine asset type from content type or file extension if not provided
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";
    const finalAssetType = assetType || fileExtension;

    // Get the appropriate bucket
    const bucket = s3Utils.getBucketForAssetType(finalAssetType);

    // Generate unique key
    const bucketKey = s3Utils.generateAssetKey(
      userId,
      filename,
      finalAssetType
    );

    // Generate presigned upload URL
    const uploadUrl = await s3Utils.getPutPresignedUrl(
      bucket,
      bucketKey,
      contentType
    );

    // Generate the final S3 URL (where the file will be accessible after upload)
    const s3Url = s3Utils.generateS3Url(bucket, bucketKey);

    return NextResponse.json({
      uploadUrl,
      s3Url,
      bucket,
      key: bucketKey,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);

    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
