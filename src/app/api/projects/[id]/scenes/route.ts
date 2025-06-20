import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    console.log(`Fetching scenes for project: ${projectId}`);

    // Get scenes with all their elements from database
    const scenes = await prisma.scene.findMany({
      where: {
        projectId: projectId,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        elements: {
          orderBy: {
            zIndex: "asc",
          },
          include: {
            asset: true, // Include asset data if referenced
          },
        }, // Include all elements for each scene
      },
    });

    if (!scenes || scenes.length === 0) {
      console.log(`No scenes found for project: ${projectId}`);
      return NextResponse.json({ scenes: [] }, { status: 200 });
    }

    console.log(`Found ${scenes.length} scenes for project: ${projectId}`);

    // Count total elements across all scenes for debugging
    const totalElements = scenes.reduce(
      (sum, scene) => sum + (scene.elements?.length || 0),
      0
    );
    console.log(`Total elements found in database: ${totalElements}`);

    // Process scenes to ensure all required properties are present
    const processedScenes = scenes.map((scene) => {
      // Make sure all elements have the necessary properties for rendering
      const processedElements = scene.elements.map((element) => {
        // Ensure all required properties exist
        return {
          ...element,
          x: element.x ?? 0,
          y: element.y ?? 0,
          width: element.width ?? 20,
          height: element.height ?? 10,
          rotation: element.rotation ?? 0,
          opacity: element.opacity ?? 1,
          zIndex: element.zIndex ?? 0,
          // Make sure content is serialized properly
          content:
            typeof element.content === "object"
              ? JSON.stringify(element.content)
              : element.content,
        };
      });

      // Sort elements by zIndex to ensure proper rendering order
      processedElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      return {
        ...scene,
        elements: processedElements,
        // Set flag to ensure elements are rendered server-side
        renderElementsServerSide: true,
      };
    });

    return NextResponse.json({ scenes: processedScenes }, { status: 200 });
  } catch (error) {
    console.error("Error fetching scenes:", error);
    return NextResponse.json(
      { error: "Failed to fetch scenes" },
      { status: 500 }
    );
  }
}
