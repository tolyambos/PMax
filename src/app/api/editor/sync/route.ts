import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/utils/db";

// Schema for editor state sync with enhanced content handling
const EditorStateSyncSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1).optional(),
  scenes: z.array(
    z.object({
      id: z.string().min(1),
      order: z.number().int().min(0),
      duration: z.number().min(0.1).max(60).default(3),
      imageUrl: z.string().min(1).optional().nullable(), // Flexible for S3 presigned URLs
      videoUrl: z.string().min(1).optional().nullable(), // Flexible for S3 presigned URLs
      backgroundColor: z.string().optional(),
      prompt: z.string().optional().nullable(),
      animate: z.boolean().optional(), // This is kept for client compatibility
      imagePrompt: z.string().optional().nullable(), // For animation prompt
      animationStatus: z.string().optional().nullable(),
      animationPrompt: z.string().optional().nullable(),
      elements: z.array(
        z.object({
          id: z.string().min(1).optional(), // Allow undefined for new elements
          type: z.string(),
          content: z.string().optional().nullable(), // Accept stringified content
          x: z.number().default(0),
          y: z.number().default(0),
          width: z.number().optional().nullable(),
          height: z.number().optional().nullable(),
          rotation: z.number().default(0),
          opacity: z.number().default(1.0),
          zIndex: z.number().default(0),
          url: z.string().optional().nullable(), // URL for image/video/audio elements
          assetId: z.string().optional().nullable(),
          style: z.any().optional(), // Add style property to schema
        })
      ),
    })
  ),
});

// API endpoint to sync editor state with database
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

    console.log("Editor sync request received");
    console.log("Request body scenes length:", body.scenes?.length || 0);
    console.log(
      "First scene elements:",
      body.scenes?.[0]?.elements?.length || 0
    );

    // Log the first element if it exists
    if (body.scenes?.[0]?.elements?.length > 0) {
      const firstElement = body.scenes[0].elements[0];
      console.log(
        "First element sample:",
        JSON.stringify(
          {
            id: firstElement.id,
            type: firstElement.type,
            content: firstElement.content,
          },
          null,
          2
        )
      );

      // Extra logging for fonts
      try {
        const contentObj =
          typeof firstElement.content === "string"
            ? JSON.parse(firstElement.content)
            : firstElement.content;

        console.log("First element font properties:", {
          fontFamily: contentObj?.style?.fontFamily,
          fontWeight: contentObj?.style?.fontWeight,
          textShadow: contentObj?.style?.textShadow,
        });
      } catch (e) {
        console.log("Could not parse element content for font info:", e);
      }
    }

    // Validate request using try/catch
    try {
      body = EditorStateSyncSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        console.error("Validation errors:", JSON.stringify(errors, null, 2));

        // Check for specific errors related to content field
        const contentErrors = errors.filter((e) => e.path.includes("content"));
        if (contentErrors.length > 0) {
          console.error("Content validation errors:", contentErrors);

          // Log the problematic content
          const scenePath = contentErrors[0].path
            .split(".")
            .slice(0, 3)
            .join(".");
          const sceneIndex = parseInt(contentErrors[0].path.split(".")[1]);
          const elementIndex = parseInt(contentErrors[0].path.split(".")[3]);

          if (
            !isNaN(sceneIndex) &&
            !isNaN(elementIndex) &&
            body.scenes?.[sceneIndex]?.elements?.[elementIndex]
          ) {
            const problematicElement =
              body.scenes[sceneIndex].elements[elementIndex];
            console.error(
              "Problematic element:",
              JSON.stringify(
                {
                  id: problematicElement.id,
                  type: problematicElement.type,
                  content:
                    typeof problematicElement.content === "string"
                      ? problematicElement.content.substring(0, 100) + "..."
                      : JSON.stringify(problematicElement.content).substring(
                          0,
                          100
                        ) + "...",
                  width: problematicElement.width,
                  height: problematicElement.height,
                },
                null,
                2
              )
            );
          }
        }

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

    const { projectId, projectName, scenes } = body;

    // Split the operation into smaller chunks to avoid issues with large transactions
    const result = await prisma.$transaction(async (tx) => {
      // Update project name if provided (wrapped in try/catch)
      if (projectName) {
        try {
          await tx.project.update({
            where: { id: projectId },
            data: { name: projectName },
          });
        } catch (error) {
          console.error("Error updating project name:", error);
          // Continue with the rest of the transaction
        }
      }

      // Define interfaces for database objects
      interface DbScene {
        id: string;
        order: number;
        duration: number;
        projectId: string;
        imageUrl?: string | null;
        videoUrl?: string | null;
        prompt?: string | null;
        animationPrompt?: string | null;
        animationStatus?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
        elements?: DbElement[];
      }

      interface DbElement {
        id: string;
        type: string;
        content?: string | null;
        x: number;
        y: number;
        width?: number | null;
        height?: number | null;
        rotation: number;
        opacity: number;
        zIndex: number;
        sceneId: string;
        assetId?: string | null;
        url?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
      }

      // Get existing scenes to preserve their data
      let existingScenes: DbScene[] = [];
      try {
        existingScenes = await tx.scene.findMany({
          where: {
            projectId: projectId,
          },
        });
      } catch (error) {
        console.error("Error finding existing scenes:", error);
        existingScenes = [];
      }

      console.log(`Found ${existingScenes.length} existing scenes to preserve`);

      // Create a map of existing scenes by id for faster lookups
      const existingScenesById = existingScenes.reduce(
        (acc, scene) => {
          acc[scene.id] = scene;
          return acc;
        },
        {} as Record<string, DbScene>
      );

      // Get existing elements to preserve them
      let existingElements: DbElement[] = [];
      try {
        existingElements = await tx.element.findMany({
          where: {
            sceneId: {
              in: scenes.map((scene) => scene.id),
            },
          },
        });
      } catch (error) {
        console.error("Error finding existing elements:", error);
        existingElements = [];
      }

      console.log(
        `Found ${existingElements.length} existing elements to preserve`
      );

      // Create a map of existing elements by sceneId for faster lookups
      const existingElementsBySceneId = existingElements.reduce(
        (acc, element) => {
          if (!acc[element.sceneId]) {
            acc[element.sceneId] = [];
          }
          acc[element.sceneId].push(element);
          return acc;
        },
        {} as Record<string, any[]>
      );

      // Track which elements are still present in the editor
      // This will help us identify which elements should be deleted
      const elementIdsToKeepBySceneId: Record<string, Set<string>> = {};

      // Process scenes
      const processedScenes = [];
      for (const scene of scenes) {
        console.log(
          `Scene ${scene.id} has ${scene.elements?.length || 0} elements to process`
        );

        // Extract fields, remove client-side only properties
        const {
          id,
          order,
          duration,
          imageUrl,
          videoUrl,
          prompt,
          animate,
          elements = [],
          imagePrompt,
          animationStatus,
          animationPrompt,
          ...rest
        } = scene;

        // Extract useAnimatedVersion safely
        const useAnimatedVersion = (scene as any).useAnimatedVersion;

        // Log the elements for this scene
        console.log(
          `Scene ${id} has ${elements?.length || 0} elements to process`
        );

        let createdScene;
        try {
          // Create or update scene
          createdScene = await tx.scene.upsert({
            where: { id },
            create: {
              id,
              projectId,
              order,
              duration,
              imageUrl: imageUrl || null,
              videoUrl: videoUrl || null,
              prompt: prompt || null,
              animate: animate || false, // Save animate flag to database
              useAnimatedVersion: useAnimatedVersion || null, // Save user's export choice
              animationStatus: animationStatus || null,
              animationPrompt: animationPrompt || null,
            },
            update: {
              id,
              order,
              duration,
              imageUrl: imageUrl || null,
              videoUrl: videoUrl || null,
              prompt: prompt || null,
              projectId,
              animate: animate || false, // Update animate flag in database
              useAnimatedVersion: useAnimatedVersion || null, // Update user's export choice
              animationStatus: animationStatus || null,
              animationPrompt: animationPrompt || null,
            },
          });

          processedScenes.push(createdScene);
        } catch (error) {
          console.error(`Error upserting scene ${id}:`, error);
          // Skip this scene and continue with others
          continue;
        }

        if (!createdScene) {
          console.error(`Failed to create/update scene ${id}`);
          continue;
        }

        // Process elements for the current scene
        if (elements && elements.length > 0) {
          // Extract element IDs to identify elements that need to be removed
          const elementIds = elements.map((e) => e.id).filter(Boolean);

          // Prepare element data for database
          const elementData = elements.map((element) => {
            // Check if element ID already exists or needs to be generated
            // Add safety check for undefined/non-string element.id
            let elementId = element?.id;

            // Special handling for IDs to prevent duplication
            if (elementId && typeof elementId === "string") {
              // Only handle true timestamp suffixes, not scene IDs or other valid suffixes
              // Timestamp suffixes are purely numeric and typically 13+ digits (unix timestamp in ms)
              if (elementId.includes("-") && /\d{13,}$/.test(elementId)) {
                const parts = elementId.split("-");
                const lastPart = parts[parts.length - 1];
                // Double-check this is actually a timestamp (unix timestamp range)
                const timestamp = parseInt(lastPart);
                if (timestamp > 1000000000000 && timestamp < 9999999999999) {
                  const baseId = parts.slice(0, -1).join("-");
                  console.log(
                    `Removing timestamp from element ID: ${elementId} -> ${baseId}`
                  );
                  elementId = baseId;
                }
              }

              // Only set to undefined for new frontend elements that need server-generated IDs
              if (elementId.startsWith("element-")) {
                elementId = undefined;
              }
            }

            // Process content string (convert properly to string if needed)
            let elementContent = element.content;
            if (typeof elementContent !== "string") {
              try {
                elementContent = JSON.stringify(elementContent);
              } catch (e) {
                console.error(`Error stringifying content for element:`, e);
                elementContent = JSON.stringify({
                  text: "Error parsing content",
                });
              }
            }

            // Add element ID to the set of IDs to keep for this scene
            if (elementId) {
              if (!elementIdsToKeepBySceneId[scene.id]) {
                elementIdsToKeepBySceneId[scene.id] = new Set<string>();
              }
              elementIdsToKeepBySceneId[scene.id].add(elementId);
            }

            return {
              // If element ID starts with "element-", generate a new database ID
              id: elementId,
              type: element.type,
              content: elementContent,
              x: parseFloat(String(element.x || 0)),
              y: parseFloat(String(element.y || 0)),
              width:
                element.width !== undefined && element.width !== null
                  ? parseFloat(String(element.width))
                  : null,
              height:
                element.height !== undefined && element.height !== null
                  ? parseFloat(String(element.height))
                  : null,
              rotation: parseFloat(String(element.rotation || 0)),
              opacity: parseFloat(String(element.opacity || 1.0)),
              zIndex: parseInt(String(element.zIndex || 0), 10),
              url: element.url || null,
              assetId: element.assetId || null,
              sceneId: createdScene.id,
            };
          });

          // Log the element data for debugging
          console.log(
            "Element data being created:",
            JSON.stringify(
              elementData.map((el) => ({
                id: el.id,
                type: el.type,
                fontInfo: (() => {
                  try {
                    const content = JSON.parse(el.content);
                    return {
                      fontFamily: content?.style?.fontFamily,
                      fontWeight: content?.style?.fontWeight,
                    };
                  } catch (e) {
                    return "Error parsing content";
                  }
                })(),
              })),
              null,
              2
            )
          );

          // Create elements one by one to handle errors better
          for (const element of elementData) {
            try {
              console.log(
                `Attempting to create element in database: ${JSON.stringify(
                  {
                    id: element.id,
                    type: element.type,
                    sceneId: element.sceneId,
                    contentPreview: element.content
                      ? element.content.substring(0, 50) + "..."
                      : "undefined",
                  },
                  null,
                  2
                )}`
              );

              // Use upsert instead of create to handle both new and existing elements
              let createdElement;

              if (element.id) {
                // Existing element - use upsert
                createdElement = await tx.element.upsert({
                  where: {
                    id: element.id,
                  },
                  create: {
                    type: element.type,
                    content: element.content,
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                    rotation: element.rotation,
                    opacity: element.opacity,
                    zIndex: element.zIndex,
                    url: element.url,
                    assetId: element.assetId,
                    sceneId: element.sceneId,
                  },
                  update: {
                    type: element.type,
                    content: element.content,
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                    rotation: element.rotation,
                    opacity: element.opacity,
                    zIndex: element.zIndex,
                    url: element.url,
                    assetId: element.assetId,
                    sceneId: element.sceneId,
                  },
                });
              } else {
                // New element - use create and let database generate ID
                createdElement = await tx.element.create({
                  data: {
                    type: element.type,
                    content: element.content,
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                    rotation: element.rotation,
                    opacity: element.opacity,
                    zIndex: element.zIndex,
                    url: element.url,
                    assetId: element.assetId,
                    sceneId: element.sceneId,
                  },
                });
              }

              console.log(
                `Successfully created/updated element with ID: ${createdElement.id}`
              );
              // Log the mapping between frontend ID and database ID for debugging
              if (
                element?.id &&
                typeof element.id === "string" &&
                element.id.startsWith("element-")
              ) {
                console.log(
                  `Frontend element ID ${element.id} saved with database ID ${createdElement.id}`
                );
              }
            } catch (createElementError) {
              console.error(
                `Error creating element for scene ${createdScene.id}:`,
                createElementError
              );
              // Log details but continue with next element
              if (createElementError instanceof Error) {
                console.error(`Error message: ${createElementError.message}`);
                console.error(`Error stack: ${createElementError.stack}`);
              }
            }
          }
        }

        // Delete elements that are no longer present in the editor
        const sceneElementsToDelete =
          existingElementsBySceneId[createdScene.id] || [];
        const sceneElementIdsToKeep =
          elementIdsToKeepBySceneId[createdScene.id] || new Set<string>();

        const elementsToDelete = sceneElementsToDelete.filter(
          (element) => !sceneElementIdsToKeep.has(element.id)
        );

        if (elementsToDelete.length > 0) {
          try {
            await tx.element.deleteMany({
              where: {
                id: {
                  in: elementsToDelete.map((element) => element.id),
                },
                sceneId: createdScene.id, // Ensure we only delete elements from this scene
              },
            });
            console.log(
              `Deleted ${elementsToDelete.length} elements for scene ${createdScene.id}`
            );
          } catch (deleteError) {
            console.error(
              `Error deleting elements for scene ${createdScene.id}:`,
              deleteError
            );
          }
        }
      }

      // Get the updated project with scenes and elements
      let updatedProject;
      try {
        updatedProject = await tx.project.findUnique({
          where: { id: projectId },
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
      } catch (error) {
        console.error("Error retrieving updated project:", error);
        // Return processed scenes as a fallback
        return {
          id: projectId,
          scenes: processedScenes,
        };
      }

      return updatedProject;
    });

    return NextResponse.json({
      success: true,
      message: "Editor state synced with database",
      project: result,
    });
  } catch (error) {
    console.error("Error syncing editor state:", error);

    return NextResponse.json(
      { error: "Failed to sync editor state" },
      { status: 500 }
    );
  }
}
