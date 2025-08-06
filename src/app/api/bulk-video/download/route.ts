import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { s3Utils } from "@/lib/s3-utils";
import archiver from "archiver";
import { PassThrough } from "stream";

// POST /api/bulk-video/download - Generate download URLs for multiple videos
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoIds, format } = await request.json();

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: "No videos selected" },
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

    // Get rendered videos
    const renderedVideos = await prisma.renderedVideo.findMany({
      where: {
        bulkVideo: {
          userId: user.id,
          id: { in: videoIds },
        },
        status: "completed",
        ...(format && { format }),
      },
      include: {
        bulkVideo: {
          select: {
            id: true,
            rowIndex: true,
            textContent: true,
          },
        },
      },
    });

    if (renderedVideos.length === 0) {
      return NextResponse.json(
        { error: "No rendered videos found" },
        { status: 404 }
      );
    }

    // Generate presigned URLs for each video
    const downloadUrls = await Promise.all(
      renderedVideos.map(async (video) => {
        try {
          if (!video.url) {
            console.error(`Video ${video.id} has no URL`);
            return null;
          }
          const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(video.url);
          const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);
          
          return {
            id: video.id,
            bulkVideoId: video.bulkVideoId,
            format: video.format,
            filename: `video-${video.bulkVideo.rowIndex}-${video.format.replace("x", "-")}.mp4`,
            url: presignedUrl,
            textContent: video.bulkVideo.textContent,
          };
        } catch (error) {
          console.error(`Failed to generate presigned URL for video ${video.id}:`, error);
          return null;
        }
      })
    );

    // Filter out any failed URLs
    const validUrls = downloadUrls.filter(url => url !== null);

    return NextResponse.json({
      videos: validUrls,
      total: validUrls.length,
    });
  } catch (error) {
    console.error("Error generating download URLs:", error);
    return NextResponse.json(
      { error: "Failed to generate download URLs" },
      { status: 500 }
    );
  }
}

// GET /api/bulk-video/download?videoIds=id1,id2&format=1080x1920 - Stream zip file
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const videoIdsParam = searchParams.get("videoIds");
    const format = searchParams.get("format");

    if (!videoIdsParam) {
      return NextResponse.json(
        { error: "No videos specified" },
        { status: 400 }
      );
    }

    const videoIds = videoIdsParam.split(",");

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get rendered videos
    const renderedVideos = await prisma.renderedVideo.findMany({
      where: {
        bulkVideo: {
          userId: user.id,
          id: { in: videoIds },
        },
        status: "completed",
        ...(format && { format }),
      },
      include: {
        bulkVideo: {
          select: {
            id: true,
            rowIndex: true,
            textContent: true,
            project: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (renderedVideos.length === 0) {
      return NextResponse.json(
        { error: "No rendered videos found" },
        { status: 404 }
      );
    }

    // Create a pass-through stream for the zip
    const passThrough = new PassThrough();
    const archive = archiver("zip", {
      zlib: { level: 5 }, // Compression level (0-9)
    });

    // Handle errors
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      passThrough.destroy();
    });

    // Pipe archive data to the pass-through stream
    archive.pipe(passThrough);

    // Add videos to the archive
    for (const video of renderedVideos) {
      try {
        if (!video.url) {
          console.error(`Video ${video.id} has no URL`);
          continue;
        }
        const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(video.url);
        const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);
        
        // Fetch the video
        const response = await fetch(presignedUrl);
        if (!response.ok) {
          console.error(`Failed to fetch video ${video.id}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Add to archive with organized folder structure
        const folderName = video.bulkVideo.project.name.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `${folderName}/video-${video.bulkVideo.rowIndex}-${video.format.replace("x", "-")}.mp4`;
        
        archive.append(buffer, { name: filename });
      } catch (error) {
        console.error(`Failed to add video ${video.id} to archive:`, error);
      }
    }

    // Finalize the archive
    archive.finalize();

    // Create response with appropriate headers
    const response = new NextResponse(passThrough as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bulk-videos-${Date.now()}.zip"`,
      },
    });

    return response;
  } catch (error) {
    console.error("Error creating zip download:", error);
    return NextResponse.json(
      { error: "Failed to create zip download" },
      { status: 500 }
    );
  }
}