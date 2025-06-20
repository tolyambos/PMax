import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the user's most recent project (likely the one being generated)
    const recentProject = await prisma.project.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        scenes: {
          include: {
            elements: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!recentProject) {
      return NextResponse.json({
        status: "not_found",
        message: "No recent project found",
      });
    }

    // Check if project generation seems complete
    const hasScenes = recentProject.scenes && recentProject.scenes.length > 0;
    const allScenesHaveImages = recentProject.scenes.every(
      (scene) => scene.imageUrl || scene.videoUrl
    );

    let status = "generating";
    if (hasScenes && allScenesHaveImages) {
      status = "completed";
    } else if (hasScenes) {
      status = "partial";
    }

    return NextResponse.json({
      status,
      project: {
        id: recentProject.id,
        name: recentProject.name,
        sceneCount: recentProject.scenes.length,
        completedScenes: recentProject.scenes.filter(
          (s) => s.imageUrl || s.videoUrl
        ).length,
      },
    });
  } catch (error) {
    console.error("Error checking project status:", error);
    return NextResponse.json(
      { error: "Failed to check project status" },
      { status: 500 }
    );
  }
}
