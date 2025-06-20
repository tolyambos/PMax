import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";

export async function POST(request: NextRequest) {
  try {
    // Check authentication using Clerk
    const authResult = auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const clerkUserId = authResult.userId;

    // Ensure user exists in database and get the database user ID
    let userId: string;
    try {
      // Check if this would be the first user
      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;
      
      const user = await prisma.user.upsert({
        where: { clerkId: clerkUserId },
        update: {},
        create: {
          clerkId: clerkUserId,
          email: "", // Will be updated by webhook
          name: "User", // Will be updated by webhook
          role: isFirstUser ? "ADMIN" : "USER",
          permissions: {
            create: {
              canCreateProjects: isFirstUser, // Only admin (first user) can create projects by default
              canUploadAssets: true,
              maxProjects: isFirstUser ? 1000 : 0, // Admin gets 1000, regular users get 0 by default
              maxAssetStorage: isFirstUser ? 107374182400 : 1073741824, // 100GB for admin, 1GB for users
            },
          },
        },
        include: {
          permissions: true,
        },
      });
      userId = user.id; // Use the database user ID, not the Clerk ID
    } catch (syncError) {
      console.error("Error syncing user:", syncError);
      return NextResponse.json(
        { error: "Failed to authenticate user" },
        { status: 500 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get file type (image, video, audio)
    const fileType = getFileType(file.type);
    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const fileName = `${uuidv4()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // Convert file to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get the appropriate S3 bucket for the file type
    const bucket = s3Utils.getBucketForAssetType(fileType);

    // Generate S3 key (path within bucket) - use Clerk ID for folder structure
    const s3Key = s3Utils.generateAssetKey(clerkUserId, fileName, fileType);

    // Get content type
    const contentType = file.type || `${fileType}/*`;

    // Upload to S3
    await s3Utils.uploadBufferToS3(bucket, s3Key, buffer, contentType);

    // Generate S3 URL
    const fileUrl = s3Utils.generateS3Url(bucket, s3Key);

    console.log(`File uploaded successfully to S3: ${fileUrl}`);

    // Save to database
    const asset = await prisma.asset.create({
      data: {
        userId,
        name: file.name,
        type: fileType,
        url: fileUrl,
        thumbnail: fileType === "image" ? fileUrl : "",
        tags: [], // Ensure tags is stored as an empty array
        bucket: bucket, // Store S3 bucket
        s3Key: s3Key, // Store S3 key
        fileSize: buffer.length, // Store file size
        mimeType: contentType, // Store MIME type
      },
    });

    console.log(`Asset created with ID: ${asset.id}`);

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      url: fileUrl,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// Helper function to determine file type
function getFileType(mimeType: string): "image" | "video" | "audio" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}
