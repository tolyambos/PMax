import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: {
    sceneId: string;
  };
}

// GET /api/bulk-video/scene/[sceneId]/status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sceneId = params.sceneId;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get scene with versions
    const scene = await prisma.bulkVideoScene.findFirst({
      where: {
        id: sceneId,
        bulkVideo: {
          userId: user.id,
        },
      },
      include: {
        imageVersions: {
          orderBy: { version: 'desc' },
          take: 5, // Last 5 versions
        },
        animationVersions: {
          orderBy: { version: 'desc' },
          take: 5, // Last 5 versions
        },
      },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: scene.id,
      status: scene.status,
      error: scene.error,
      currentImage: scene.imageUrl,
      currentAnimation: scene.animationUrl,
      imageVersions: scene.imageVersions,
      animationVersions: scene.animationVersions,
    });
  } catch (error) {
    console.error("Error fetching scene status:", error);
    return NextResponse.json(
      { error: "Failed to fetch scene status" },
      { status: 500 }
    );
  }
}