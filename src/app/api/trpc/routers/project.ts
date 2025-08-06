import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/app/api/trpc/trpc";
import { generateVideoFromPrompt } from "@/app/utils/ai";
import { canCreateProject } from "@/lib/auth";
import { s3Utils } from "@/lib/s3-utils";

export const projectRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        prompt: z.string().optional(),
        format: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { userId } = ctx;

        // Get user with permissions for permission checking
        const user = await ctx.prisma.user.findUnique({
          where: { id: userId },
          include: { permissions: true },
        });

        if (!user) {
          throw new Error("User not found");
        }

        // Check if user can create projects
        const canCreate = await canCreateProject(user);
        if (!canCreate.allowed) {
          throw new Error(canCreate.reason || "Permission denied");
        }

        console.log(
          `Creating project for user ${userId} with name: ${input.name}. Current projects: ${canCreate.currentCount}/${canCreate.maxProjects}`
        );

        // Create the project with simplified data for safer serialization
        const project = await ctx.prisma.project.create({
          data: {
            name: input.name,
            description: input.description || "",
            format: input.format,
            prompt: input.prompt || "",
            userId,
          },
        });

        console.log(`Created project with ID: ${project.id}`);

        // If prompt is provided, generate initial scenes
        if (input.prompt) {
          const sceneData = await generateVideoFromPrompt(
            input.prompt,
            input.format
          );
          console.log(`Generated ${sceneData.length} scenes from prompt`);

          // Create initial scenes
          for (let i = 0; i < sceneData.length; i++) {
            await ctx.prisma.scene.create({
              data: {
                projectId: project.id,
                order: i,
                duration: 3,
                prompt: sceneData[i].prompt || "",
                imageUrl: sceneData[i].imageUrl || "",
              },
            });
          }
        }

        // Return safe project data structure
        return {
          id: project.id,
          name: project.name,
          description: project.description || "",
          format: project.format,
          duration: project.duration,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error("Error creating project:", error);
        throw new Error(
          "Failed to create project: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    try {
      console.log("Getting all projects for user:", ctx.userId);
      const projects = await ctx.prisma.project.findMany({
        where: {
          userId: ctx.userId,
        },
        include: {
          scenes: {
            orderBy: {
              order: "asc",
            },
          },
          bulkVideos: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      // Debug what's returned
      console.log(`Found ${projects.length} projects for user ${ctx.userId}`);

      // Map to a safe data structure for serialization
      // Helper function to refresh S3 URL if needed
      const refreshS3Url = async (url: string | null): Promise<string> => {
        if (!url) return "";

        // Check if it's an S3 URL that needs refreshing
        if (url.includes("s3.eu-central-1.wasabisys.com")) {
          try {
            // Check if URL has expired (X-Amz-Date parameter)
            const urlObj = new URL(url);
            const amzDate = urlObj.searchParams.get("X-Amz-Date");

            if (amzDate) {
              // Simple check: if the URL is more than 6 days old, refresh it
              const urlDate = new Date(
                amzDate.slice(0, 4) +
                  "-" +
                  amzDate.slice(4, 6) +
                  "-" +
                  amzDate.slice(6, 8)
              );
              const daysSinceCreation =
                (Date.now() - urlDate.getTime()) / (1000 * 60 * 60 * 24);

              if (daysSinceCreation > 6) {
                // Extract bucket and key and get fresh URL
                const { bucket, bucketKey } =
                  s3Utils.extractBucketAndKeyFromUrl(url);
                return await s3Utils.getPresignedUrl(bucket, bucketKey);
              }
            }
          } catch (error) {
            console.error("Error refreshing S3 URL:", error);
          }
        }

        return url;
      };

      const safeProjects = await Promise.all(
        projects.map(async (project) => {
          // Get thumbnail - use project thumbnail or first scene's image
          const projectWithScenes = project as typeof project & {
            scenes: Array<{ imageUrl: string | null }>;
            bulkVideos: Array<{ id: string; status: string }>;
          };
          let thumbnailUrl = "";
          
          // Get thumbnail based on project type
          if (projectWithScenes.projectType === "bulk-video" && projectWithScenes.bulkVideos?.length > 0) {
            // For bulk projects, try to get thumbnail from first video's first scene
            console.log(`[getAll] Fetching thumbnail for bulk project: ${projectWithScenes.name} (${projectWithScenes.id})`);
            
            const bulkVideoWithScenes = await ctx.prisma.bulkVideo.findFirst({
              where: {
                projectId: projectWithScenes.id,
                scenes: {
                  some: {
                    imageUrl: { not: null }
                  }
                }
              },
              include: {
                scenes: {
                  where: {
                    imageUrl: { not: null }
                  },
                  take: 1,
                  orderBy: { order: 'asc' }
                }
              }
            });
            
            console.log(`[getAll] Found bulk video with scenes:`, {
              projectId: projectWithScenes.id,
              videoId: bulkVideoWithScenes?.id,
              sceneCount: bulkVideoWithScenes?.scenes?.length || 0,
              firstSceneImage: bulkVideoWithScenes?.scenes[0]?.imageUrl?.substring(0, 50) || 'none'
            });
            
            if (bulkVideoWithScenes?.scenes[0]?.imageUrl) {
              thumbnailUrl = bulkVideoWithScenes.scenes[0].imageUrl;
            }
          } else {
            // For regular projects, use existing logic
            thumbnailUrl = projectWithScenes.thumbnail || projectWithScenes.scenes[0]?.imageUrl || "";
          }

          // Refresh the thumbnail URL if it's an S3 URL
          if (thumbnailUrl) {
            thumbnailUrl = await refreshS3Url(thumbnailUrl);
          }

          return {
            id: projectWithScenes.id,
            name: projectWithScenes.name,
            description: projectWithScenes.description || "",
            format: projectWithScenes.format,
            duration: projectWithScenes.duration,
            thumbnail: thumbnailUrl,
            videoUrl: projectWithScenes.videoUrl || "",
            published: projectWithScenes.published,
            adType: "",
            style: "",
            totalDuration: projectWithScenes.duration || 0,
            scenes: projectWithScenes.scenes.map((scene) => ({
              id: scene.id,
              order: scene.order,
              duration: scene.duration,
              imageUrl: scene.imageUrl || "",
              videoUrl: scene.videoUrl || "",
              prompt: scene.prompt || "",
              animate: scene.animate || false,
              useAnimatedVersion: scene.useAnimatedVersion || false,
            })),
            bulkVideos: projectWithScenes.bulkVideos || [],
            isBulk: projectWithScenes.projectType === "bulk-video",
            createdAt: projectWithScenes.createdAt.toISOString(),
            updatedAt: projectWithScenes.updatedAt.toISOString(),
          };
        })
      );

      console.log(
        `Returning projects with scenes:`,
        safeProjects.map((p) => ({
          name: p.name,
          sceneCount: p.scenes.length,
          firstSceneImageUrl: p.scenes[0]?.imageUrl || "no image",
        }))
      );

      return safeProjects;
    } catch (error) {
      console.error("Error fetching projects:", error);
      // Return empty array instead of throwing an error
      return [];
    }
  }),

  getById: protectedProcedure
    .input(
      // Handle both cases: undefined input or object with id
      z.union([
        // Case 1: No input provided
        z.undefined(),
        // Case 2: Object with id field
        z.object({
          id: z
            .string({
              required_error: "Project ID is required",
              invalid_type_error: "Project ID must be a string",
            })
            .min(1, "Project ID cannot be empty"),
        }),
      ])
    )
    .query(async ({ ctx, input }) => {
      // Handle the undefined input case by generating a synthetic input object
      const processingInput = input || { id: "fallback-" + Date.now() };
      // Extract ID from the object for the rest of the code
      const projectId =
        "id" in processingInput ? processingInput.id : "fallback-" + Date.now();
      try {
        console.log(
          `Looking up project with ID: ${projectId}, userId: ${ctx.userId}`
        );

        // Debugging to see what's being received
        console.log("getById input:", JSON.stringify(processingInput));
        console.log(
          "getById context:",
          JSON.stringify({
            userId: ctx.userId,
            hasUser: !!ctx.userId,
          })
        );

        // Handle undefined or empty input
        if (!projectId || projectId === "undefined") {
          console.log("Invalid project ID provided:", projectId);

          // Don't auto-create projects - return error instead
          throw new Error(
            "Invalid project ID provided. Please create a project first."
          );
        }

        // For any non-standard IDs, we'll handle them specially
        const isGeneratedId =
          projectId.startsWith("project-") ||
          projectId.startsWith("scene-") ||
          projectId === "new" ||
          projectId.includes("undefined") ||
          projectId.startsWith("fallback-") ||
          projectId === "cm9mzu36700016y9dgowar4eh"; // Special case for existing project

        if (isGeneratedId) {
          console.log("Creating or finding project record for special ID");

          // First try to find any existing project
          const existingProjects = await ctx.prisma.project.findMany({
            where: {
              userId: ctx.userId,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          });

          // If we have an existing project, use it
          if (existingProjects.length > 0) {
            const existingProject = existingProjects[0];
            console.log(
              `Using existing project with ID: ${existingProject.id}`
            );

            // Fetch the full project with scenes
            const fullProject = await ctx.prisma.project.findUnique({
              where: {
                id: existingProject.id,
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

            if (fullProject) {
              // Debug logging for existing project scenario
              console.log(
                `[PROJECT_ROUTER]: ✅ Found existing project: ${fullProject.id}`
              );
              console.log(
                `[PROJECT_ROUTER]: ✅ Existing project has ${fullProject.scenes.length} scenes`
              );
              if (fullProject.scenes.length > 0) {
                console.log(
                  `[PROJECT_ROUTER]: ✅ First scene has ${fullProject.scenes[0].elements.length} elements`
                );
                console.log(
                  `[PROJECT_ROUTER]: ✅ First scene animation status: ${fullProject.scenes[0].animationStatus || "none"}`
                );
              }

              return {
                id: fullProject.id,
                name: fullProject.name,
                description: fullProject.description || "",
                userId: fullProject.userId,
                format: fullProject.format,
                duration: fullProject.duration,
                thumbnail: fullProject.thumbnail || "",
                videoUrl: fullProject.videoUrl || "",
                published: fullProject.published,
                prompt: fullProject.prompt || "",
                createdAt: fullProject.createdAt.toISOString(),
                updatedAt: fullProject.updatedAt.toISOString(),
                scenes: fullProject.scenes.map((scene) => ({
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
            }
          }

          // If no existing project, don't auto-create - return error instead
          throw new Error("No projects found. Please create a project first.");
        }

        // For standard project IDs, fetch from database normally
        const project = await ctx.prisma.project.findUnique({
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
          console.log(`Project not found: ${projectId}`);
          throw new Error("Project not found");
        }

        // Only check user ownership in production
        if (
          process.env.NODE_ENV !== "development" &&
          project.userId !== ctx.userId
        ) {
          console.log(
            `Unauthorized access: User ${ctx.userId} tried to access project ${projectId} owned by ${project.userId}`
          );
          throw new Error("Unauthorized access to project");
        }

        // Debug logging to help diagnose the issue
        console.log(
          `[PROJECT_ROUTER]: ✅ Successfully retrieved project: ${project.id}`
        );
        console.log(
          `[PROJECT_ROUTER]: ✅ Project has ${project.scenes.length} scenes`
        );
        if (project.scenes.length > 0) {
          console.log(
            `[PROJECT_ROUTER]: ✅ First scene has ${project.scenes[0].elements.length} elements`
          );
          console.log(
            `[PROJECT_ROUTER]: ✅ First scene animation status: ${project.scenes[0].animationStatus || "none"}`
          );
        }

        // Map to a safe serializable structure
        return {
          id: project.id,
          name: project.name,
          description: project.description || "",
          userId: project.userId,
          format: project.format,
          duration: project.duration,
          thumbnail: project.thumbnail || project.scenes[0]?.imageUrl || "",
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
      } catch (error) {
        console.error("Error fetching project by ID:", error);

        // Don't auto-create projects in any environment to prevent permission bypass

        throw new Error(
          "Failed to fetch project: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
        duration: z.number().optional(),
        thumbnail: z.string().optional(),
        published: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        console.log(`Updating project ${id} with data:`, data);

        const project = await ctx.prisma.project.update({
          where: {
            id,
          },
          data,
          include: {
            scenes: {
              take: 1,
              orderBy: {
                order: "asc",
              },
            },
          },
        });

        // Return safe serializable data
        return {
          id: project.id,
          name: project.name,
          description: project.description || "",
          format: project.format,
          duration: project.duration,
          thumbnail: project.thumbnail || project.scenes[0]?.imageUrl || "",
          videoUrl: project.videoUrl || "",
          published: project.published,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error("Error updating project:", error);
        throw new Error(
          "Failed to update project: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`Deleting project ${input.id}`);

        await ctx.prisma.project.delete({
          where: {
            id: input.id,
          },
        });

        return { success: true };
      } catch (error) {
        console.error("Error deleting project:", error);
        throw new Error(
          "Failed to delete project: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }),

  export: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(
          `Exporting project ${input.id} in format: ${input.format || "default"}`
        );

        // This would trigger video rendering process
        // For MVP, we'll just update the project with a mock video URL
        const project = await ctx.prisma.project.update({
          where: {
            id: input.id,
          },
          data: {
            videoUrl: `https://example.com/video/${input.id}.mp4`,
          },
        });

        // Return safe serializable data
        return {
          id: project.id,
          name: project.name,
          videoUrl: project.videoUrl || "",
          format: project.format,
          updatedAt: project.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error("Error exporting project:", error);
        throw new Error(
          "Failed to export project: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }),
});
