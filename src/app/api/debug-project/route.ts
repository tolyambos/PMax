import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";

export async function GET(req: Request) {
  try {
    // Get project ID from URL query parameter
    const url = new URL(req.url);
    const projectId = url.searchParams.get("id");

    if (!projectId) {
      return NextResponse.json(
        { error: "No project ID provided" },
        { status: 400 }
      );
    }

    console.log(
      `[DEBUG-PROJECT]: Fetching project ${projectId} directly from database`
    );

    // Fetch the project with scenes and elements
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
      include: {
        scenes: {
          include: {
            elements: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Log information about the project
    console.log(
      `[DEBUG-PROJECT]: Project ${project.id} found with ${project.scenes.length} scenes`
    );
    if (project.scenes.length > 0) {
      console.log(`[DEBUG-PROJECT]: First scene ID: ${project.scenes[0].id}`);
      console.log(
        `[DEBUG-PROJECT]: First scene has ${project.scenes[0].elements.length} elements`
      );
      console.log(
        `[DEBUG-PROJECT]: First scene animation status: ${project.scenes[0].animationStatus || "none"}`
      );
    }

    // Format fields for serialization
    const formattedProject = {
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      scenes: project.scenes.map((scene) => ({
        ...scene,
        createdAt: scene.createdAt.toISOString(),
        updatedAt: scene.updatedAt.toISOString(),
        elements: scene.elements.map((element) => ({
          ...element,
          createdAt: element.createdAt.toISOString(),
          updatedAt: element.updatedAt.toISOString(),
        })),
      })),
    };

    return NextResponse.json({
      success: true,
      project: formattedProject,
    });
  } catch (error) {
    console.error("[DEBUG-PROJECT]: Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
