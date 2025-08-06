import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: {
    sceneId: string;
  };
}

// GET /api/bulk-video/scene/[sceneId]/versions
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

    // Verify scene ownership
    const scene = await prisma.bulkVideoScene.findFirst({
      where: {
        id: sceneId,
        bulkVideo: {
          userId: user.id,
        },
      },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found or access denied" },
        { status: 404 }
      );
    }

    // Get all versions
    const [imageVersions, animationVersions] = await Promise.all([
      prisma.sceneImageVersion.findMany({
        where: { sceneId },
        orderBy: { version: 'desc' },
      }),
      prisma.sceneAnimationVersion.findMany({
        where: { sceneId },
        orderBy: { version: 'desc' },
      }),
    ]);

    return NextResponse.json({
      imageVersions,
      animationVersions,
    });
  } catch (error) {
    console.error("Error fetching scene versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch scene versions" },
      { status: 500 }
    );
  }
}

// POST /api/bulk-video/scene/[sceneId]/versions
// Set active version
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sceneId = params.sceneId;
    const { type, versionId } = await request.json();

    if (!type || !versionId) {
      return NextResponse.json(
        { error: "Type and versionId are required" },
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

    // Verify scene ownership
    const scene = await prisma.bulkVideoScene.findFirst({
      where: {
        id: sceneId,
        bulkVideo: {
          userId: user.id,
        },
      },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found or access denied" },
        { status: 404 }
      );
    }

    if (type === 'image') {
      // Get the version to activate
      const version = await prisma.sceneImageVersion.findUnique({
        where: { id: versionId },
      });

      if (!version || version.sceneId !== sceneId) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 }
        );
      }

      // Deactivate all other versions
      await prisma.sceneImageVersion.updateMany({
        where: {
          sceneId,
          id: { not: versionId },
        },
        data: { isActive: false },
      });

      // Activate selected version
      await prisma.sceneImageVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });

      // Update scene with active image
      await prisma.bulkVideoScene.update({
        where: { id: sceneId },
        data: { imageUrl: version.imageUrl },
      });
    } else if (type === 'animation') {
      // Get the version to activate
      const version = await prisma.sceneAnimationVersion.findUnique({
        where: { id: versionId },
      });

      if (!version || version.sceneId !== sceneId) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 }
        );
      }

      // Deactivate all other versions
      await prisma.sceneAnimationVersion.updateMany({
        where: {
          sceneId,
          id: { not: versionId },
        },
        data: { isActive: false },
      });

      // Activate selected version
      await prisma.sceneAnimationVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });

      // Update scene with active animation
      await prisma.bulkVideoScene.update({
        where: { id: sceneId },
        data: {
          animationUrl: version.animationUrl,
          animationProvider: version.animationProvider,
          animationPrompt: version.animationPrompt,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be 'image' or 'animation'" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type} version activated`,
    });
  } catch (error) {
    console.error("Error setting active version:", error);
    return NextResponse.json(
      { error: "Failed to set active version" },
      { status: 500 }
    );
  }
}