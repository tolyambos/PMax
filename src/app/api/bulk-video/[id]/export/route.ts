import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/bulk-video/[id]/export - Export all rendered videos as ZIP
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    const { searchParams } = new URL(request.url);
    const videoIds = searchParams.get("videos")?.split(",") || [];
    const structure = searchParams.get("structure") || "organized"; // flat or organized

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get project with rendered videos
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
        projectType: "bulk-video",
      },
      include: {
        bulkVideos: {
          where: videoIds.length > 0 ? { id: { in: videoIds } } : undefined,
          include: {
            renderedVideos: {
              where: {
                status: "completed",
                url: { not: null },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Collect all rendered videos
    const videoFiles: Array<{
      url: string;
      format: string;
      videoIndex: number;
      textPreview: string;
    }> = [];

    project.bulkVideos.forEach((video, index) => {
      video.renderedVideos.forEach((rendered) => {
        if (rendered.url) {
          videoFiles.push({
            url: rendered.url,
            format: rendered.format,
            videoIndex: video.rowIndex,
            textPreview: video.textContent.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_"),
          });
        }
      });
    });

    if (videoFiles.length === 0) {
      return NextResponse.json(
        { error: "No rendered videos found" },
        { status: 404 }
      );
    }

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Create metadata JSON
    const metadata = {
      project: {
        id: project.id,
        name: project.name,
        exportDate: new Date().toISOString(),
      },
      settings: {
        formats: project.defaultFormats,
        duration: project.defaultDuration,
        sceneCount: project.defaultSceneCount,
      },
      videos: project.bulkVideos.map((v) => ({
        index: v.rowIndex,
        text: v.textContent,
        status: v.status,
        formats: v.renderedVideos.map((r) => ({
          format: r.format,
          filename: `video-${String(v.rowIndex).padStart(3, "0")}-${r.format.replace("x", "-")}.mp4`,
        })),
      })),
    };

    // Add metadata to archive
    archive.append(JSON.stringify(metadata, null, 2), { name: "metadata.json" });

    // Download and add video files
    for (const file of videoFiles) {
      try {
        const response = await fetch(file.url);
        if (!response.ok) continue;

        const buffer = await response.arrayBuffer();
        
        let filename: string;
        if (structure === "organized") {
          // Organized by format
          const formatFolder = file.format.replace("x", "-");
          filename = `${formatFolder}/video-${String(file.videoIndex).padStart(3, "0")}-${file.textPreview}.mp4`;
        } else {
          // Flat structure
          filename = `video-${String(file.videoIndex).padStart(3, "0")}-${file.format.replace("x", "-")}.mp4`;
        }

        archive.append(Buffer.from(buffer), { name: filename });
      } catch (error) {
        console.error(`Failed to download video: ${file.url}`, error);
      }
    }

    // Finalize archive
    await archive.finalize();

    // Convert archive stream to response
    const chunks: Uint8Array[] = [];
    for await (const chunk of archive) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Return ZIP file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, "_")}-export-${Date.now()}.zip"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error exporting bulk videos:", error);
    return NextResponse.json(
      { error: "Failed to export videos" },
      { status: 500 }
    );
  }
}