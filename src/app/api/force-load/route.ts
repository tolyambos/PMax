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

    console.log(`[FORCE-LOAD]: Attempting to force-load project ${projectId}`);

    // First, try a direct database query using Prisma
    try {
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

      if (project) {
        console.log(
          `[FORCE-LOAD]: Successfully loaded project ${project.id} with ${project.scenes.length} scenes`
        );

        // Process project data
        const processedProject = {
          ...project,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          scenes: project.scenes.map((scene) => ({
            ...scene,
            createdAt: scene.createdAt.toISOString(),
            updatedAt: scene.updatedAt.toISOString(),
            // Ensure animation fields are present
            imageUrl: scene.imageUrl || "",
            videoUrl: scene.videoUrl || "",
            prompt: scene.prompt || "",
            animationStatus: scene.animationStatus || "",
            animationPrompt: scene.animationPrompt || "",
            elements: scene.elements.map((element) => ({
              ...element,
              createdAt: element.createdAt.toISOString(),
              updatedAt: element.updatedAt.toISOString(),
            })),
          })),
        };

        return NextResponse.json({
          success: true,
          method: "prisma",
          project: processedProject,
        });
      }
    } catch (prismaError) {
      console.error("[FORCE-LOAD]: Prisma query failed:", prismaError);
    }

    // If Prisma fails, try a raw SQL query
    try {
      // Query for the project
      const projectResult = await prisma.$queryRaw`
        SELECT * FROM "Project" WHERE id = ${projectId}
      `;

      const project = Array.isArray(projectResult) ? projectResult[0] : null;

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Query for scenes
      const scenes = await prisma.$queryRaw`
        SELECT * FROM "Scene" WHERE "projectId" = ${projectId} ORDER BY "order" ASC
      `;

      // For each scene, get the elements
      const scenesWithElements = await Promise.all(
        (scenes as any[]).map(async (scene) => {
          const elements = await prisma.$queryRaw`
            SELECT * FROM "Element" WHERE "sceneId" = ${scene.id}
          `;

          return {
            ...scene,
            createdAt: new Date(scene.createdAt).toISOString(),
            updatedAt: new Date(scene.updatedAt).toISOString(),
            imageUrl: scene.imageUrl || "",
            videoUrl: scene.videoUrl || "",
            prompt: scene.prompt || "",
            animationStatus: scene.animationStatus || "",
            animationPrompt: scene.animationPrompt || "",
            elements: (elements as any[]).map((element) => ({
              ...element,
              createdAt: new Date(element.createdAt).toISOString(),
              updatedAt: new Date(element.updatedAt).toISOString(),
            })),
          };
        })
      );

      // Build the complete project
      const rawProjectData = {
        ...project,
        createdAt: new Date(project.createdAt).toISOString(),
        updatedAt: new Date(project.updatedAt).toISOString(),
        scenes: scenesWithElements,
      };

      console.log(
        `[FORCE-LOAD]: Successfully loaded project via raw SQL: ${project.id} with ${scenesWithElements.length} scenes`
      );

      return NextResponse.json({
        success: true,
        method: "rawSQL",
        project: rawProjectData,
      });
    } catch (sqlError) {
      console.error("[FORCE-LOAD]: Raw SQL query failed:", sqlError);
      return NextResponse.json(
        {
          error: "Failed to load project with both methods",
          prismaError: "See server logs",
          sqlError: String(sqlError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[FORCE-LOAD]: Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
