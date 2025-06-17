import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/utils/db";

// Schema for fallback animation requests
const FallbackAnimationRequestSchema = z.object({
  sceneId: z.string(),
  projectId: z.string(),
});

export async function POST(req: Request) {
  try {
    // Parse and validate request
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Log the request
    console.log("Fallback animation request received");

    // Validate request
    try {
      body = FallbackAnimationRequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return NextResponse.json(
          { error: "Validation error", details: errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    const { sceneId, projectId } = body;

    // Find the scene to make sure it exists
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    if (scene.projectId !== projectId) {
      return NextResponse.json(
        { error: "Scene does not belong to specified project" },
        { status: 400 }
      );
    }

    // List of available sample animations
    const sampleAnimations = [
      "/animations/animation-fromStorage-scene-1744922171886-1-1744922209419.mp4",
      "/animations/animation-fromStorage-scene-1744922176324-2-1744923007335.mp4",
      "/animations/animation-fromStorage-scene-1744922176324-2-1744923602288.mp4",
      "/animations/animation-fromStorage-scene-1744924749885-3-1744924895000.mp4",
      "/animations/animation-fromStorage-scene-1744971306843-3-1744971421969.mp4",
      "/animations/animation-fromStorage-scene-1744971306843-3-1744973406688.mp4",
    ];

    // Randomly select a sample animation
    const randomIndex = Math.floor(Math.random() * sampleAnimations.length);
    const videoUrl = sampleAnimations[randomIndex];

    // Update the scene in the database
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        videoUrl,
        animationStatus: "completed",
      },
    });

    console.log(
      `Scene ${sceneId} updated with fallback animation: ${videoUrl}`
    );

    return NextResponse.json({
      success: true,
      sceneId,
      videoUrl,
      animationStatus: "completed",
      message: "Fallback animation applied successfully",
    });
  } catch (error) {
    console.error("Error applying fallback animation:", error);

    // Try to update the scene's status to indicate failure
    try {
      const { sceneId } = FallbackAnimationRequestSchema.parse(
        await req.json()
      );
      await prisma.scene.update({
        where: { id: sceneId },
        data: { animationStatus: "failed" },
      });
    } catch (e) {
      // Ignore errors in this fallback handling
    }

    return NextResponse.json(
      { error: "Failed to apply fallback animation", details: String(error) },
      { status: 500 }
    );
  }
}
