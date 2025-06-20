import { NextRequest, NextResponse } from "next/server";
import { mockProjects, mockScenes } from "@/app/mock-data";
import { prisma } from "@/lib/prisma";

/**
 * GET handler for fetching a specific project by ID
 * GET /api/projects/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log(`Fetching project with ID: ${id}`);

    // Try to get project from database first
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          scenes: {
            orderBy: { order: "asc" },
            include: {
              elements: true,
            },
          },
        },
      });

      if (project) {
        console.log(`Found project in database: ${project.name}`);
        // Log elements for debugging
        if (project.scenes.length > 0) {
          console.log(
            `First scene elements count: ${project.scenes[0].elements?.length || 0}`
          );
        }
        return NextResponse.json({
          success: true,
          id: project.id,
          name: project.name,
          description: project.description || "",
          format: project.format,
          duration: project.duration,
          thumbnail: project.thumbnail || "",
          videoUrl: project.videoUrl || "",
          published: project.published,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          scenes: project.scenes.map((scene) => ({
            id: scene.id,
            order: scene.order,
            duration: scene.duration || 3,
            imageUrl: scene.imageUrl || "",
            prompt: scene.prompt || "",
            videoUrl: scene.videoUrl || "",
            animate: scene.animate || false, // Include animate flag from database
            animationStatus: scene.animationStatus || undefined,
            animationPrompt: scene.animationPrompt || undefined,
            useAnimatedVersion: scene.useAnimatedVersion,
            backgroundHistory: scene.backgroundHistory || [],
            animationHistory: scene.animationHistory || [],
            elements:
              scene.elements.map((element) => {
                // Debug log the element data
                console.log(`[Project API] Element ${element.id}:`, {
                  id: element.id,
                  type: element.type,
                  url: element.url,
                  assetId: element.assetId,
                  hasContent: !!element.content,
                });

                return {
                  id: element.id,
                  type: element.type,
                  content: element.content,
                  x: element.x,
                  y: element.y,
                  width: element.width,
                  height: element.height,
                  rotation: element.rotation,
                  opacity: element.opacity,
                  zIndex: element.zIndex,
                  url: element.url, // Explicitly include URL
                  assetId: element.assetId,
                };
              }) || [],
          })),
        });
      }
    } catch (dbError) {
      console.warn("Database error, falling back to mock data:", dbError);
      // Continue to mock data if DB error
    }

    // Fallback to mock data if no project found in database
    console.log("Project not found in database, using mock data");
    const mockProject = mockProjects.find((p) => p.id === id);

    if (!mockProject) {
      // If not found in mock data either, create a new mock project with this ID
      console.log(`Creating new mock project with ID: ${id}`);
      const newMockProject = {
        id,
        name: "New Project",
        description: "Auto-generated project",
        format: "9:16",
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnail: "https://picsum.photos/seed/101/300/600",
        scenes: mockScenes, // Use default scenes
      };

      return NextResponse.json({
        success: true,
        ...newMockProject,
        scenes: mockScenes,
      });
    }

    return NextResponse.json({
      success: true,
      ...mockProject,
      scenes: mockScenes,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating a project by ID
 * PUT /api/projects/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    console.log(`Updating project with ID: ${id}`);

    // Try to update in database first
    try {
      const updatedProject = await prisma.project.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          format: body.format,
          duration: body.duration,
          thumbnail: body.thumbnail,
          videoUrl: body.videoUrl,
          published: body.published,
        },
      });

      if (updatedProject) {
        return NextResponse.json({
          success: true,
          project: updatedProject,
        });
      }
    } catch (dbError) {
      console.warn("Database error, falling back to mock update:", dbError);
      // Continue to mock update if DB error
    }

    // Mock update logic
    console.log("Project not found in database, using mock update");
    return NextResponse.json({
      success: true,
      project: {
        id,
        ...body,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update project" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting a project by ID
 * DELETE /api/projects/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log(`Deleting project with ID: ${id}`);

    // Try to delete from database first
    try {
      await prisma.project.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (dbError) {
      console.warn("Database error, falling back to mock delete:", dbError);
      // Continue to mock delete if DB error
    }

    // Mock delete logic
    console.log("Project not found in database, using mock delete");
    return NextResponse.json({
      success: true,
      message: "Project deleted successfully (mock)",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
