import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Direct API endpoint to load a project without going through tRPC
 * This provides a more reliable way to get project data
 */
export async function GET(request: NextRequest) {
  try {
    // Get project ID from query
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "No project ID provided",
        },
        { status: 400 }
      );
    }

    console.log(`[DIRECT API] Loading project with ID: ${projectId}`);

    // Fetch project with all related data
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
      console.log(`[DIRECT API] Project not found with ID: ${projectId}`);

      // Try to find most recent project instead
      const recentProjects = await prisma.project.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      });

      if (recentProjects.length > 0) {
        console.log(
          `[DIRECT API] Using most recent project instead: ${recentProjects[0].id}`
        );
        return NextResponse.json({
          success: false,
          message: `Project ${projectId} not found, but found recent project`,
          redirectTo: `/editor/${recentProjects[0].id}`,
        });
      }

      // If still no project, create a new one
      console.log(`[DIRECT API] No projects found. Creating a new one.`);

      const newProject = await prisma.project.create({
        data: {
          name: "New Project",
          description: "Created automatically",
          userId: "dev-user-id",
          format: "9:16",
        },
      });

      console.log(`[DIRECT API] Created new project with ID: ${newProject.id}`);

      return NextResponse.json({
        success: true,
        message: "Created new project",
        project: {
          id: newProject.id,
          name: newProject.name,
          description: newProject.description || "",
          userId: newProject.userId,
          format: newProject.format,
          duration: newProject.duration,
          thumbnail: newProject.thumbnail || "",
          videoUrl: newProject.videoUrl || "",
          published: newProject.published,
          prompt: newProject.prompt || "",
          createdAt: newProject.createdAt.toISOString(),
          updatedAt: newProject.updatedAt.toISOString(),
          scenes: [],
        },
      });
    }

    // Map to a safe serializable structure
    const safeProject = {
      id: project.id,
      name: project.name,
      description: project.description || "",
      userId: project.userId,
      format: project.format,
      duration: project.duration,
      thumbnail: project.thumbnail || "",
      videoUrl: project.videoUrl || "",
      published: project.published,
      prompt: project.prompt || "",
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      scenes: project.scenes.map((scene) => ({
        id: scene.id,
        projectId: scene.projectId,
        order: scene.order,
        duration: scene.duration,
        imageUrl: scene.imageUrl || "",
        videoUrl: scene.videoUrl || "",
        prompt: scene.prompt || "",
        animationStatus: scene.animationStatus || "",
        animationPrompt: scene.animationPrompt || "",
        createdAt: scene.createdAt.toISOString(),
        updatedAt: scene.updatedAt.toISOString(),
        elements: scene.elements.map((element) => ({
          id: element.id,
          sceneId: element.sceneId,
          type: element.type,
          content: element.content || "",
          x: element.x,
          y: element.y,
          width: element.width || 0,
          height: element.height || 0,
          rotation: element.rotation,
          opacity: element.opacity,
          zIndex: element.zIndex,
          assetId: element.assetId || null,
          createdAt: element.createdAt.toISOString(),
          updatedAt: element.updatedAt.toISOString(),
        })),
      })),
    };

    console.log(
      `[DIRECT API] Loaded project: ${project.name} with ${safeProject.scenes.length} scenes`
    );

    return NextResponse.json({
      success: true,
      project: safeProject,
    });
  } catch (error) {
    console.error("[DIRECT API] Error loading project:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
