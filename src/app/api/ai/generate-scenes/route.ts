import { NextResponse } from "next/server";
import { generateVideoFromPrompt } from "@/app/utils/ai";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Define request schema with additional fields
const RequestSchema = z.object({
  prompt: z.string().min(3).max(1000),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  numScenes: z.number().int().min(1).max(5).default(3),
  style: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Log the request for debugging
    console.log("Scene generation request:", body);

    // Validate request using Zod schema
    try {
      body = RequestSchema.parse(body);
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

    const { prompt, format, numScenes } = body;

    // Get userId (dev-user-id for development, auth for production)
    const userId =
      process.env.NODE_ENV === "development" ? "dev-user-id" : "auth-user-id";

    // Generate scenes from the prompt with the specified number of scenes
    console.log(
      `Generating ${numScenes} scenes in ${format} format with prompt: ${prompt}`
    );
    const scenes = await generateVideoFromPrompt(
      prompt,
      format,
      numScenes,
      userId
    );

    // Create a project and save scenes to database
    try {
      const project = await prisma.project.create({
        data: {
          name: `Generated Project - ${prompt.substring(0, 30)}`,
          description: `AI-generated project from prompt: ${prompt}`,
          userId: userId,
          format: format,
          prompt: prompt,
        },
      });

      console.log(`Created project with ID: ${project.id}`);

      // Create scenes in database
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        await prisma.scene.create({
          data: {
            projectId: project.id,
            order: i,
            duration: scene.duration * 1000, // Convert to milliseconds for database
            imageUrl: scene.imageUrl || "",
            prompt: scene.prompt || "",
          },
        });
      }

      console.log(`Created ${scenes.length} scenes for project ${project.id}`);

      return NextResponse.json({
        scenes,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          format: project.format,
        },
        success: true,
        timestamp: new Date().toISOString(),
        format: format,
        numScenes: scenes.length,
      });
    } catch (dbError) {
      console.error("Error saving to database:", dbError);
      // Still return the scenes even if database save fails
      return NextResponse.json({
        scenes,
        success: true,
        timestamp: new Date().toISOString(),
        format: format,
        numScenes: scenes.length,
        warning: "Scenes generated but not saved to database",
      });
    }
  } catch (error) {
    console.error("Error generating scenes:", error);

    // Determine status code and message based on error
    const isClientError =
      error instanceof Error &&
      (error.message.includes("Invalid") || error.message.includes("required"));

    return NextResponse.json(
      {
        error: isClientError ? error.message : "Failed to generate scenes",
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: isClientError ? 400 : 500 }
    );
  }
}
