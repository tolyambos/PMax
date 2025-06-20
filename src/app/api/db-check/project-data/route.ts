import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    console.log(`Fetching complete project data for ID: ${projectId}`);

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
      console.log(`Project not found with ID: ${projectId}`);

      // Try to find most recent project instead
      const recentProjects = await prisma.project.findMany({
        where: {
          userId: "dev-user-id",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      });

      if (recentProjects.length > 0) {
        console.log(
          `Using most recent project instead: ${recentProjects[0].id}`
        );
        return NextResponse.json({
          success: false,
          message: `Project ${projectId} not found, but found recent project`,
          redirectTo: `/editor/${recentProjects[0].id}`,
        });
      }

      return NextResponse.json(
        {
          success: false,
          message: `Project with ID ${projectId} not found`,
        },
        { status: 404 }
      );
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
        // Include animation fields to ensure they're returned to the client
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

    console.log(`Returning project with ${safeProject.scenes.length} scenes`);

    return NextResponse.json({
      success: true,
      project: safeProject,
    });
  } catch (error) {
    console.error("Error fetching project data:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
