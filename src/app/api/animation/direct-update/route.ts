import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/utils/db";

// Schema for direct animation updates
const DirectUpdateRequestSchema = z.object({
  sceneId: z.string(),
  videoUrl: z.string().optional(),
  animationStatus: z
    .enum(["pending", "processing", "completed", "failed"])
    .default("completed"),
  animationPrompt: z.string().optional(),
});

/**
 * API endpoint to update animation data directly using SQL
 * This is a fallback for when Prisma fails to update animation fields
 */
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

    console.log("Direct animation update request received");

    // Validate request
    try {
      body = DirectUpdateRequestSchema.parse(body);
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

    const { sceneId, videoUrl, animationStatus, animationPrompt } = body;

    // Try to update the scene using Prisma first
    try {
      const updateData = {
        animationStatus,
        ...(videoUrl && { videoUrl }),
        ...(animationPrompt && { animationPrompt }),
      };

      await prisma.scene.update({
        where: { id: sceneId },
        data: updateData,
      });

      console.log(`Scene ${sceneId} updated successfully with Prisma`);

      return NextResponse.json({
        success: true,
        message: "Scene updated successfully",
        sceneId,
      });
    } catch (prismaError) {
      console.error(
        "Error updating scene with Prisma, trying direct SQL:",
        prismaError
      );

      // Fall back to direct SQL update with proper parameter escaping
      try {
        // Start with the status which is always required
        await prisma.$executeRaw`
          UPDATE "Scene" 
          SET "animationStatus" = ${animationStatus}
          ${videoUrl ? prisma.$executeRaw`, "videoUrl" = ${videoUrl}` : prisma.$executeRaw``}
          ${animationPrompt ? prisma.$executeRaw`, "animationPrompt" = ${animationPrompt}` : prisma.$executeRaw``}
          WHERE "id" = ${sceneId}
        `;

        console.log(`Scene ${sceneId} updated via direct SQL`);

        return NextResponse.json({
          success: true,
          message: "Scene updated successfully via direct SQL",
          sceneId,
          usedFallback: true,
        });
      } catch (sqlError) {
        console.error("Failed to update via direct SQL:", sqlError);

        // Last resort: try super simple update with executeRawUnsafe
        try {
          let fieldsToUpdate = [`"animationStatus" = '${animationStatus}'`];

          if (videoUrl) {
            fieldsToUpdate.push(
              `"videoUrl" = '${videoUrl.replace(/'/g, "''")}'`
            );
          }

          if (animationPrompt) {
            fieldsToUpdate.push(
              `"animationPrompt" = '${animationPrompt.replace(/'/g, "''")}'`
            );
          }

          const command = `
            UPDATE "Scene" 
            SET ${fieldsToUpdate.join(", ")}
            WHERE "id" = '${sceneId}'
          `;

          await prisma.$executeRawUnsafe(command);

          console.log(`Scene ${sceneId} updated via direct SQL unsafe command`);

          return NextResponse.json({
            success: true,
            message: "Scene updated via direct SQL last resort method",
            sceneId,
            usedFallback: true,
            lastResort: true,
          });
        } catch (lastError) {
          console.error(
            "Failed to update even with last resort method:",
            lastError
          );

          return NextResponse.json(
            {
              error: "Failed to update scene with all methods",
              prismaError: String(prismaError),
              sqlError: String(sqlError),
              lastError: String(lastError),
            },
            { status: 500 }
          );
        }
      }
    }
  } catch (error) {
    console.error("Unexpected error during scene update:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
