import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/app/utils/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[DEBUG] Scene ID: ${params.id}`);

    // Check authentication using Clerk
    const authResult = auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database using Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Test database connection
    const scene = await prisma.scene.findFirst({
      where: {
        id: params.id,
        project: {
          userId: user.id,
        },
      },
      select: {
        id: true,
        projectId: true,
        backgroundHistory: true,
        animationHistory: true,
        imageUrl: true,
        videoUrl: true,
      },
    });

    console.log(`[DEBUG] Scene found:`, scene);

    if (!scene) {
      return NextResponse.json(
        {
          error: "Scene not found",
          sceneId: params.id,
        },
        { status: 404 }
      );
    }

    // Parse histories
    let bgHistory = [];
    let animHistory = [];

    if (scene.backgroundHistory) {
      try {
        bgHistory =
          typeof scene.backgroundHistory === "string"
            ? JSON.parse(scene.backgroundHistory)
            : scene.backgroundHistory;
      } catch (e) {
        console.error("[DEBUG] Error parsing background history:", e);
      }
    }

    if (scene.animationHistory) {
      try {
        animHistory =
          typeof scene.animationHistory === "string"
            ? JSON.parse(scene.animationHistory)
            : scene.animationHistory;
      } catch (e) {
        console.error("[DEBUG] Error parsing animation history:", e);
      }
    }

    return NextResponse.json({
      success: true,
      sceneId: params.id,
      scene: {
        id: scene.id,
        projectId: scene.projectId,
        imageUrl: scene.imageUrl,
        videoUrl: scene.videoUrl,
        backgroundHistoryRaw: scene.backgroundHistory,
        animationHistoryRaw: scene.animationHistory,
        backgroundHistoryParsed: bgHistory,
        animationHistoryParsed: animHistory,
        backgroundHistoryCount: Array.isArray(bgHistory) ? bgHistory.length : 0,
        animationHistoryCount: Array.isArray(animHistory)
          ? animHistory.length
          : 0,
      },
      message: "Debug successful",
    });
  } catch (error) {
    console.error("[DEBUG] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
