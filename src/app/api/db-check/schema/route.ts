import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get the Prisma schema information for the Scene model
    const sceneModel = await prisma.$queryRaw`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'Scene';
    `;

    // Check for animation-related fields
    const hasAnimationStatus =
      Array.isArray(sceneModel) &&
      sceneModel.some((col: any) => col.column_name === "animationStatus");

    const hasAnimationPrompt =
      Array.isArray(sceneModel) &&
      sceneModel.some((col: any) => col.column_name === "animationPrompt");

    // Try to add a test scene with animation fields
    let testSceneResult = null;
    let testSceneError = null;

    try {
      // Try to create a test scene with animation fields
      testSceneResult = await prisma.scene.create({
        data: {
          projectId: "test-project-id",
          order: 0,
          duration: 3,
          animationStatus: "test", // Test if this field exists
          animationPrompt: "test prompt", // Test if this field exists
        },
      });

      // If successful, delete the test scene to clean up
      if (testSceneResult?.id) {
        await prisma.scene.delete({
          where: { id: testSceneResult.id },
        });
      }
    } catch (error) {
      // Capture the error for reporting
      testSceneError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json({
      status: "ok",
      sceneModel,
      hasAnimationStatus,
      hasAnimationPrompt,
      testSceneResult: testSceneResult !== null,
      testSceneError,
    });
  } catch (error) {
    console.error("Error checking schema:", error);

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
