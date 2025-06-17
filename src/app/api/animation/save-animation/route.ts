import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/utils/db";

// Schema for direct animation saving
const SaveAnimationSchema = z.object({
  sceneId: z.string().min(1),
  videoUrl: z.string().min(1),
  animationStatus: z
    .enum(["pending", "processing", "completed", "failed"])
    .default("completed"),
});

/**
 * API endpoint to save animation video URL directly
 * This is a simple, dedicated endpoint that bypasses tRPC entirely
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

    console.log("Animation save request received:", body);

    // Validate request
    try {
      body = SaveAnimationSchema.parse(body);
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

    const { sceneId, videoUrl, animationStatus } = body;

    // Check if the scene exists before trying to update it
    try {
      const sceneExists = await prisma.scene.findUnique({
        where: { id: sceneId },
      });

      if (!sceneExists) {
        console.log(
          `Scene ${sceneId} not found, checking for scenes with the same project`
        );

        // Try to find the scene's project to update the most recent scene instead
        const sceneProject = await prisma.$queryRaw<
          Array<{ projectId: string }>
        >`
          SELECT "projectId" FROM "Scene" WHERE "id" = ${sceneId}
        `;

        if (sceneProject && sceneProject[0]?.projectId) {
          const projectId = sceneProject[0].projectId;
          console.log(
            `Found project ID ${projectId} for the missing scene, updating most recent scene`
          );

          // Get the most recent scene for this project
          const latestScene = await prisma.scene.findFirst({
            where: { projectId },
            orderBy: { createdAt: "desc" },
          });

          if (latestScene) {
            console.log(
              `Using latest scene ${latestScene.id} instead of missing scene ${sceneId}`
            );
            // Update the latest scene instead
            await prisma.scene.update({
              where: { id: latestScene.id },
              data: {
                videoUrl,
                animationStatus,
              },
            });

            return NextResponse.json({
              success: true,
              sceneId: latestScene.id,
              videoUrl,
              animationStatus,
              note: `Original scene ${sceneId} not found, updated latest scene ${latestScene.id} instead`,
            });
          }
        }

        // If we couldn't find a replacement scene, return an error
        return NextResponse.json(
          { error: `Scene ${sceneId} not found and no replacement found` },
          { status: 404 }
        );
      }
    } catch (checkError) {
      console.error("Error checking if scene exists:", checkError);
      // Continue with the update attempts anyway
    }

    // Try all possible ways to update the scene
    const methods = [
      // Method 1: Standard Prisma update
      async () => {
        try {
          const result = await prisma.scene.update({
            where: { id: sceneId },
            data: {
              videoUrl,
              animationStatus,
            },
          });
          return { success: true, method: "prisma", result };
        } catch (error) {
          console.log("Method 1 (Prisma) failed:", error);
          throw error;
        }
      },

      // Method 2: Raw SQL with parameters
      async () => {
        try {
          await prisma.$executeRaw`
            UPDATE "Scene" 
            SET "videoUrl" = ${videoUrl}, 
                "animationStatus" = ${animationStatus}
            WHERE "id" = ${sceneId}
          `;
          return { success: true, method: "raw-sql-params" };
        } catch (error) {
          console.log("Method 2 (raw SQL with params) failed:", error);
          throw error;
        }
      },

      // Method 3: Raw SQL unsafe
      async () => {
        try {
          const command = `
            UPDATE "Scene" 
            SET "videoUrl" = '${videoUrl.replace(/'/g, "''")}', 
                "animationStatus" = '${animationStatus}'
            WHERE "id" = '${sceneId}'
          `;

          await prisma.$executeRawUnsafe(command);
          return { success: true, method: "raw-sql-unsafe" };
        } catch (error) {
          console.log("Method 3 (raw SQL unsafe) failed:", error);
          throw error;
        }
      },

      // Method 4: Direct SQL update with minimal fields
      async () => {
        try {
          // Just update videoUrl as a last resort
          const command = `
            UPDATE "Scene" 
            SET "videoUrl" = '${videoUrl.replace(/'/g, "''")}'
            WHERE "id" = '${sceneId}'
          `;

          await prisma.$executeRawUnsafe(command);
          return { success: true, method: "minimal-update" };
        } catch (error) {
          console.log("Method 4 (minimal update) failed:", error);
          throw error;
        }
      },
    ];

    // Try each method in sequence until one succeeds
    let lastError = null;
    let result = null;

    for (const method of methods) {
      try {
        result = await method();
        console.log("Update succeeded with method:", result.method);
        break; // Exit the loop if a method succeeds
      } catch (error) {
        lastError = error;
        // Continue to the next method
      }
    }

    if (result) {
      // After updating, fetch the scene to verify the changes took effect
      try {
        const updatedScene = await prisma.scene.findUnique({
          where: { id: sceneId },
        });

        console.log("Scene after update:", {
          id: updatedScene?.id,
          videoUrl: updatedScene?.videoUrl,
          animationStatus: updatedScene?.animationStatus,
        });

        return NextResponse.json({
          success: true,
          method: result.method,
          sceneId,
          videoUrl: updatedScene?.videoUrl || videoUrl,
          animationStatus: updatedScene?.animationStatus || animationStatus,
          verified: !!updatedScene?.videoUrl,
        });
      } catch (verifyError) {
        console.error("Error verifying scene update:", verifyError);

        // Still return success based on the update method
        return NextResponse.json({
          success: true,
          method: result.method,
          sceneId,
          videoUrl,
          animationStatus,
          verified: false,
          verifyError: String(verifyError),
        });
      }
    }

    // If all methods failed
    return NextResponse.json(
      {
        error: "Failed to update scene with all methods",
        lastError: String(lastError),
        sceneId,
        videoUrl,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Unexpected error during scene animation save:", error);

    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
