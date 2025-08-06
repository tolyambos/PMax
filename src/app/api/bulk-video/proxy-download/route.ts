import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { s3Utils } from "@/lib/s3-utils";

// GET /api/bulk-video/proxy-download?id=renderedVideoId - Proxy download for rendered videos
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const renderedVideoId = searchParams.get("id");

    if (!renderedVideoId) {
      return NextResponse.json(
        { error: "Rendered video ID is required" },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the rendered video
    const renderedVideo = await prisma.renderedVideo.findFirst({
      where: {
        id: renderedVideoId,
        bulkVideo: {
          userId: user.id,
        },
      },
      include: {
        bulkVideo: {
          select: {
            rowIndex: true,
          },
        },
      },
    });

    if (!renderedVideo) {
      return NextResponse.json(
        { error: "Rendered video not found" },
        { status: 404 }
      );
    }

    if (!renderedVideo.url) {
      return NextResponse.json(
        { error: "Video URL not found" },
        { status: 404 }
      );
    }

    // Extract bucket and key from the URL
    const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(
      renderedVideo.url
    );

    // Generate presigned URL
    const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);

    // Fetch the video from S3
    const response = await fetch(presignedUrl);
    
    if (!response.ok) {
      console.error("Failed to fetch from S3:", {
        status: response.status,
        statusText: response.statusText,
        url: renderedVideo.url,
      });
      return NextResponse.json(
        { error: "Failed to fetch video from storage" },
        { status: response.status }
      );
    }

    // Get the video data
    const videoBuffer = await response.arrayBuffer();

    // Create filename
    const filename = `video-${renderedVideo.bulkVideo.rowIndex}-${renderedVideo.format.replace("x", "-")}.mp4`;

    // Return the video with appropriate headers
    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": videoBuffer.byteLength.toString(),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Proxy download error:", error);
    return NextResponse.json(
      { 
        error: "Failed to download video",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}