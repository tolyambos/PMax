import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";
import { prisma } from "@/app/utils/db";

export async function POST(request: NextRequest) {
  try {
    // Check authentication - use dev user ID in development
    let userId: string;

    if (process.env.NODE_ENV === "development") {
      // Use a development user ID
      userId = "dev-user-id";
      console.log("Using development user ID for S3 upload:", userId);
    } else {
      // In production, use Clerk auth
      const authResult = auth();
      if (!authResult.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = authResult.userId;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const assetType = formData.get("assetType") as string;
    const tags = formData.get("tags") as string;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine asset type from file extension if not provided
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const finalAssetType = assetType || fileExtension;

    // Get the appropriate bucket
    const bucket = s3Utils.getBucketForAssetType(finalAssetType);

    // Generate unique key
    const bucketKey = s3Utils.generateAssetKey(
      userId,
      file.name,
      finalAssetType
    );

    // Upload to S3
    await s3Utils.uploadBufferToS3(bucket, bucketKey, buffer, file.type);

    // Generate the S3 URL
    const s3Url = s3Utils.generateS3Url(bucket, bucketKey);

    // Save to database
    const asset = await prisma.asset.create({
      data: {
        userId,
        name: file.name,
        type: finalAssetType,
        url: s3Url,
        thumbnail: finalAssetType.includes("image") ? s3Url : "",
        tags: tags ? JSON.parse(tags) : [],
        fileSize: buffer.length,
        mimeType: file.type,
      },
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        url: asset.url,
        thumbnail: asset.thumbnail,
        tags: asset.tags,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
      },
    });
  } catch (error) {
    console.error("Error uploading to S3:", error);

    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
