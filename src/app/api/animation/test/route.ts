import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Try to find a project to work with
    const project = await prisma.project.findFirst({
      where: { userId: "dev-user-id" },
      include: { scenes: true },
    });

    if (!project) {
      return NextResponse.json({
        status: "error",
        message: "No project found to test",
      });
    }

    // Get Prisma information through environment
    const prismaInfo = {
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL?.split("?")[0] || "Not available", // Only include base URL, not credentials
    };

    // Print the entire Scene model structure with all fields
    // @ts-ignore - Using internal Prisma API for debugging
    const modelFields = Object.keys(prisma.scene.fields || {});

    // If there's at least one scene, try to update it with animation fields
    let scene = null;
    let updateResult = null;
    let error = null;

    if (project.scenes && project.scenes.length > 0) {
      scene = project.scenes[0];
      console.log("Found scene to test:", scene.id);

      try {
        // First try to read the scene to see its current state
        const sceneDetails = await prisma.scene.findUnique({
          where: { id: scene.id },
        });

        console.log("Scene details:", sceneDetails);

        // Try to update with videoUrl only (should work)
        const videoUpdate = await prisma.scene.update({
          where: { id: scene.id },
          data: {
            videoUrl: "https://example.com/test-video.mp4",
          },
        });

        console.log("Video URL update successful:", !!videoUpdate);

        // Try to update with animation fields
        updateResult = await prisma.scene.update({
          where: { id: scene.id },
          data: {
            animationStatus: "test",
            animationPrompt: "Test animation prompt",
          },
        });
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        console.error("Error updating scene:", error);
      }
    }

    // Return the test results
    return NextResponse.json({
      status: "ok",
      projectId: project.id,
      sceneId: scene?.id,
      prismaInfo,
      modelFields,
      updateSuccessful: !!updateResult,
      error,
      updateResult,
    });
  } catch (error) {
    console.error("Error testing animation fields:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Failed to test animation fields",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
