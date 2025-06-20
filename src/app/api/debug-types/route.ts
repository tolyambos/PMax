import { NextResponse } from "next/server";
import { DBScene, EditorScene, APIScene } from "@/app/utils/type-check";
import { prisma } from "@/lib/prisma";

// Function to get a sample DB scene
async function getSampleDBScene(): Promise<DBScene | null> {
  // Try to find a scene with animations first
  const animatedScene = await prisma.scene.findFirst({
    where: {
      NOT: {
        animationStatus: null,
      },
    },
    include: {
      elements: true,
    },
  });

  if (animatedScene) {
    return animatedScene;
  }

  // Otherwise just get any scene
  return prisma.scene.findFirst({
    include: {
      elements: true,
    },
  });
}

// Function to convert DB scene to editor format
function convertToEditorScene(dbScene: DBScene): EditorScene {
  return {
    id: dbScene.id,
    order: dbScene.order,
    duration: dbScene.duration,
    imageUrl: dbScene.imageUrl || undefined,
    videoUrl: dbScene.videoUrl || undefined,
    prompt: dbScene.prompt || undefined,
    animate:
      dbScene.animationStatus === "completed" ||
      dbScene.animationStatus === "processing" ||
      !!dbScene.videoUrl,
    animationStatus: dbScene.animationStatus || undefined,
    animationPrompt: dbScene.animationPrompt || undefined,
    elements: dbScene.elements.map((element) => ({
      id: element.id,
      type: element.type,
      content: element.content || undefined,
      x: element.x,
      y: element.y,
      width: element.width || undefined,
      height: element.height || undefined,
      rotation: element.rotation,
      opacity: element.opacity,
      zIndex: element.zIndex,
      assetId: element.assetId || undefined,
    })),
  };
}

// Function to convert DB scene to API format
function convertToAPIScene(dbScene: DBScene): APIScene {
  return {
    id: dbScene.id,
    projectId: dbScene.projectId,
    order: dbScene.order,
    duration: dbScene.duration,
    imageUrl: dbScene.imageUrl || "",
    videoUrl: dbScene.videoUrl || "",
    prompt: dbScene.prompt || "",
    animationStatus: dbScene.animationStatus || "",
    animationPrompt: dbScene.animationPrompt || "",
    createdAt: dbScene.createdAt.toISOString(),
    updatedAt: dbScene.updatedAt.toISOString(),
    elements: dbScene.elements.map((element) => ({
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
  };
}

export async function GET() {
  try {
    // Get a sample scene from the database
    const dbScene = await getSampleDBScene();

    if (!dbScene) {
      return NextResponse.json(
        {
          error: "No scenes found in database",
          dbSchemaFine: true,
        },
        { status: 404 }
      );
    }

    // Convert to editor format
    const editorScene = convertToEditorScene(dbScene);

    // Convert to API format
    const apiScene = convertToAPIScene(dbScene);

    return NextResponse.json({
      success: true,
      typeCheck: {
        dbScene: {
          id: dbScene.id,
          hasAnimationFields: dbScene.animationStatus !== undefined,
          animationStatus: dbScene.animationStatus,
          animationPrompt: dbScene.animationPrompt,
        },
        editorScene: {
          id: editorScene.id,
          hasAnimationFields: editorScene.animationStatus !== undefined,
          animationStatus: editorScene.animationStatus,
          animationPrompt: editorScene.animationPrompt,
        },
        apiScene: {
          id: apiScene.id,
          hasAnimationFields: apiScene.animationStatus !== undefined,
          animationStatus: apiScene.animationStatus,
          animationPrompt: apiScene.animationPrompt,
        },
      },
      dbScene,
      editorScene,
      apiScene,
    });
  } catch (error) {
    console.error("[DEBUG-TYPES]: Error checking types:", error);
    return NextResponse.json(
      { error: "Failed to check types" },
      { status: 500 }
    );
  }
}
