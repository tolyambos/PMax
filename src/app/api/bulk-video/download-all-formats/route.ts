import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { s3Utils } from "@/lib/s3-utils";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the video with all rendered formats and project info
    const video = await prisma.bulkVideo.findUnique({
      where: { id: videoId },
      include: {
        renderedVideos: {
          where: {
            status: "completed",
            url: { not: null },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!video || video.userId !== user.id) {
      return NextResponse.json({ error: "Video not found or unauthorized" }, { status: 404 });
    }

    if (!video.renderedVideos || video.renderedVideos.length === 0) {
      return NextResponse.json({ error: "No completed videos found" }, { status: 404 });
    }

    // Create a new zip file
    const zip = new JSZip();

    // Download each video and add to zip
    for (const rendered of video.renderedVideos) {
      try {
        const videoUrl = rendered.url;
        if (!videoUrl) continue;

        // Extract bucket and key from S3 URL
        const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(videoUrl);
        
        // Generate presigned URL for download
        const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);
        
        // Get the video data from S3
        const response = await fetch(presignedUrl);
        if (!response.ok) {
          console.error(`Failed to fetch video: ${videoUrl}`);
          continue;
        }

        const videoBuffer = await response.arrayBuffer();
        
        // Add to zip with descriptive filename
        const filename = `video-${video.rowIndex}-${rendered.format.replace("x", "-")}.mp4`;
        zip.file(filename, videoBuffer);
      } catch (error) {
        console.error(`Failed to add video to zip:`, error);
      }
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ 
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6, // Balance between speed and compression
      },
    });

    // Debug logging
    console.log("Project info:", {
      id: video.project.id,
      name: video.project.name,
      rowIndex: video.rowIndex
    });

    // Create filename with project name (sanitized for filesystem)
    const projectName = video.project.name || 'bulk-video';
    const sanitizedProjectName = projectName
      .replace(/[^a-z0-9\s]/gi, '') // Remove special chars but keep spaces
      .replace(/\s+/g, '-') // Replace spaces with single hyphen
      .toLowerCase()
      .trim();
    
    // Add readable timestamp (YYYYMMDD-HHMM format)
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Create filename: projectname-video1-allformats-20241206-1430.zip
    const zipFilename = `${sanitizedProjectName}-video${video.rowIndex}-allformats-${timestamp}.zip`;
    
    console.log("Generated filename:", zipFilename);

    // Return the zip file
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (error) {
    console.error("Error creating zip:", error);
    return NextResponse.json(
      { error: "Failed to create zip file" },
      { status: 500 }
    );
  }
}