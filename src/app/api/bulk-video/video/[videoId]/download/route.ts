import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { s3Utils } from "@/lib/s3-utils";

interface RouteParams {
  params: {
    videoId: string;
  };
}

// GET /api/bulk-video/video/[videoId]/download?format=1080x1920 - Download specific video format
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = params.videoId;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format");

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get rendered video
    const renderedVideo = await prisma.renderedVideo.findFirst({
      where: {
        bulkVideo: {
          id: videoId,
          userId: user.id,
        },
        status: "completed",
        ...(format && { format }),
      },
      include: {
        bulkVideo: {
          select: {
            rowIndex: true,
          },
        },
      },
    });

    if (!renderedVideo || !renderedVideo.url) {
      return NextResponse.json(
        { error: "Video not found or not ready" },
        { status: 404 }
      );
    }

    // Generate presigned URL for download
    const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(
      renderedVideo.url
    );
    const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);

    // Fetch the video with streaming support
    const response = await fetch(presignedUrl);
    if (!response.ok) {
      console.error("Failed to fetch video from S3:", response.status, response.statusText);
      throw new Error(`Failed to fetch video from S3: ${response.statusText}`);
    }

    // Get content length from S3 response
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type') || 'video/mp4';
    
    console.log("Streaming video download:", {
      contentLength,
      contentType,
      videoId,
      format,
    });

    // Stream the response body directly
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="video-${renderedVideo.bulkVideo.rowIndex}-${renderedVideo.format.replace("x", "-")}.mp4"`,
        "Content-Length": contentLength || '',
        "Cache-Control": "no-cache",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Error downloading video:", error);
    return NextResponse.json(
      { error: "Failed to download video" },
      { status: 500 }
    );
  }
}