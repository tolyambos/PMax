import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { BulkVideoGenerator } from "@/app/utils/bulk-video/bulk-generator";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
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

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
        projectType: "bulk-video",
      },
      include: {
        bulkVideos: {
          where: { status: "pending" },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Check if there are pending videos
    if (project.bulkVideos.length === 0) {
      return NextResponse.json(
        { error: "No pending videos to generate" },
        { status: 400 }
      );
    }

    // Start generation in background
    // In a production environment, this would be handled by a queue system
    // For now, we'll use a simple async approach
    const generator = new BulkVideoGenerator({
      concurrency: 3,
      onProgress: async (progress) => {
        // In a real app, we'd send this via WebSocket or SSE
        console.log("Generation progress:", progress);
      },
    });

    // Don't await - let it run in background
    generator.generateBulkVideos(projectId).catch((error) => {
      console.error("Bulk generation error:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Bulk video generation started",
      projectId,
    });
  } catch (error) {
    console.error("Error starting bulk video generation:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}

// GET endpoint to check generation status
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
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

    // Get project with video counts
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
        projectType: "bulk-video",
      },
      include: {
        _count: {
          select: {
            bulkVideos: true,
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

    // Get video status counts
    const statusCounts = await prisma.bulkVideo.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const counts = {
      total: project._count.bulkVideos,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    statusCounts.forEach((item) => {
      counts[item.status as keyof typeof counts] = item._count;
    });

    // Get current processing video if any
    const currentVideo = await prisma.bulkVideo.findFirst({
      where: {
        projectId,
        status: "processing",
      },
      select: {
        id: true,
        rowIndex: true,
        textContent: true,
      },
    });

    return NextResponse.json({
      projectId,
      status: counts.pending > 0 || counts.processing > 0 ? "generating" : "completed",
      progress: {
        totalVideos: counts.total,
        completedVideos: counts.completed,
        failedVideos: counts.failed,
        pendingVideos: counts.pending,
        processingVideos: counts.processing,
        currentVideo: currentVideo ? {
          id: currentVideo.id,
          index: currentVideo.rowIndex,
          text: currentVideo.textContent.substring(0, 50) + "...",
        } : null,
      },
    });
  } catch (error) {
    console.error("Error getting generation status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}