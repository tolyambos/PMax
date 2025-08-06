import { prisma } from "@/lib/prisma";
import { BulkVideo, BulkVideoScene, Project } from "@prisma/client";
import { generateBackgroundImage } from "@/app/utils/ai";
import { runwareService } from "@/app/utils/runware";
import { s3Utils } from "@/lib/s3-utils";
import { unifiedAnimationService } from "@/app/utils/animation-service";
import { BulkVideoStatus, SceneStatus } from "@/app/types/bulk-video";
import { ChatOpenAI } from "@langchain/openai";
import { analyzeImageQuality } from "@/app/utils/image-quality-analyzer";
import {
  enhancePromptWithStyle,
  getPresetById,
} from "@/app/utils/bulk-video/image-style-presets";
import {
  getStyleInstructions,
  GENERATE_BACKGROUND_PROMPT,
} from "@/app/utils/prompts";

export interface BulkGenerationOptions {
  projectId: string;
  concurrency?: number;
  onProgress?: (progress: BulkGenerationProgress) => void;
}

export interface BulkGenerationProgress {
  projectId: string;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  currentVideo?: {
    id: string;
    index: number;
    status: string;
    progress: number;
  };
}

export class BulkVideoGenerator {
  private concurrency: number;
  private onProgress?: (progress: BulkGenerationProgress) => void;

  constructor(
    options: {
      concurrency?: number;
      onProgress?: (progress: BulkGenerationProgress) => void;
    } = {}
  ) {
    this.concurrency = options.concurrency || 3; // Default to 3 concurrent videos
    this.onProgress = options.onProgress;
  }

  async generateBulkVideos(projectId: string): Promise<void> {
    console.log("[BulkGenerator] Starting generation for project:", projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { bulkVideos: true },
    });

    if (!project || project.projectType !== "bulk-video") {
      throw new Error("Invalid bulk video project");
    }

    const pendingVideos = project.bulkVideos.filter(
      (v) => v.status === "pending"
    );
    console.log("[BulkGenerator] Found pending videos:", pendingVideos.length);

    if (pendingVideos.length === 0) {
      console.log("[BulkGenerator] No pending videos to process");
      return;
    }

    const progress: BulkGenerationProgress = {
      projectId,
      totalVideos: project.bulkVideos.length,
      completedVideos: project.bulkVideos.filter(
        (v) => v.status === "completed"
      ).length,
      failedVideos: project.bulkVideos.filter((v) => v.status === "failed")
        .length,
    };

    // Process videos in batches
    for (let i = 0; i < pendingVideos.length; i += this.concurrency) {
      const batch = pendingVideos.slice(i, i + this.concurrency);

      await Promise.all(
        batch.map(async (video, batchIndex) => {
          const videoIndex = i + batchIndex;

          try {
            progress.currentVideo = {
              id: video.id,
              index: videoIndex,
              status: "processing",
              progress: 0,
            };
            this.onProgress?.(progress);

            await this.generateSingleVideo(video, project);

            progress.completedVideos++;
          } catch (error) {
            console.error(`Failed to generate video ${video.id}:`, error);

            await prisma.bulkVideo.update({
              where: { id: video.id },
              data: {
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
              },
            });

            progress.failedVideos++;
          }

          this.onProgress?.(progress);
        })
      );
    }

    // After all videos are processed, check if we should start rendering
    console.log(
      "[BulkGenerator] Checking if all videos are completed for rendering..."
    );
    const allVideos = await prisma.bulkVideo.findMany({
      where: { projectId },
      select: { id: true, status: true },
    });

    const allCompleted = allVideos.every((v) => v.status === "completed");
    const hasCompletedVideos = allVideos.some((v) => v.status === "completed");

    if (allCompleted && hasCompletedVideos) {
      console.log(
        "[BulkGenerator] All videos completed! Starting bulk render process..."
      );

      // Trigger bulk render for all completed videos
      try {
        const completedVideoIds = allVideos
          .filter((v) => v.status === "completed")
          .map((v) => v.id);

        // Import and use the renderer directly instead of HTTP request
        const { MultiFormatRenderer } = await import(
          "@/app/utils/bulk-video/multi-format-renderer"
        );
        const renderer = new MultiFormatRenderer();

        // Start rendering each video asynchronously
        let renderCount = 0;
        for (const videoId of completedVideoIds) {
          renderCount++;
          console.log(`[BulkGenerator] Starting render for video ${videoId}`);

          // Start rendering in background (don't await)
          renderer
            .renderBulkVideo(videoId, "all")
            .then(() => {
              console.log(
                `[BulkGenerator] Completed rendering video ${videoId}`
              );
            })
            .catch((error) => {
              console.error(
                `[BulkGenerator] Failed to render video ${videoId}:`,
                error
              );
            });
        }

        console.log(`[BulkGenerator] Started rendering ${renderCount} videos`);
      } catch (error) {
        console.error("[BulkGenerator] Error starting bulk render:", error);
      }
    } else {
      console.log(
        "[BulkGenerator] Not all videos completed, skipping auto-render"
      );
    }
  }

  async processSingleVideo(videoId: string): Promise<void> {
    console.log("[BulkGenerator] Processing single video:", videoId);
    
    const video = await prisma.bulkVideo.findUnique({
      where: { id: videoId },
      include: {
        project: true,
      },
    });
    
    if (!video) {
      throw new Error("Video not found");
    }
    
    await this.generateSingleVideo(video, video.project);
  }

  private async generateSingleVideo(
    video: BulkVideo,
    project: Project
  ): Promise<void> {
    console.log(
      "[BulkGenerator] Processing video:",
      video.id,
      "Row:",
      video.rowIndex
    );

    // Update status to processing
    await prisma.bulkVideo.update({
      where: { id: video.id },
      data: { status: "processing" },
    });

    // Determine settings (video overrides or project defaults)
    console.log("[BulkGenerator] Video settings:", {
      customFormats: video.customFormats,
      projectDefaultFormats: project.defaultFormats,
      defaultImageStyle: project.defaultImageStyle,
    });

    const settings = {
      imageStyle:
        video.customImageStyle ||
        project.defaultImageStyle ||
        "modern product photography",
      formats:
        video.customFormats && video.customFormats.length > 0
          ? video.customFormats
          : project.defaultFormats || ["9x16"],
      animationProvider:
        video.customAnimationProvider ||
        project.defaultAnimationProvider ||
        "Bytedance",
      duration: video.customDuration || project.defaultDuration || 5,
      sceneCount: video.customSceneCount || project.defaultSceneCount || 2,
      defaultCameraFixed:
        video.customCameraFixed ?? project.defaultCameraFixed ?? false,
      defaultUseEndImage:
        video.customUseEndImage ?? project.defaultUseEndImage ?? false,
    };

    console.log("[BulkGenerator] Final settings:", settings);

    // Generate scenes
    const sceneDuration = Math.floor(settings.duration / settings.sceneCount);

    for (let i = 0; i < settings.sceneCount; i++) {
      try {
        // Generate scene prompt with full context
        const prompt = await this.generateScenePrompt(
          video.textContent,
          video.productImageUrl,
          settings.imageStyle,
          i,
          settings.sceneCount,
          project,
          video,
          project.defaultImageStylePreset
        );

        // Create scene record
        const scene = await prisma.bulkVideoScene.create({
          data: {
            bulkVideoId: video.id,
            order: i,
            prompt,
            status: "generating",
          },
        });

        // Determine image format based on selected formats
        const formats = settings.formats;
        const isSingleFormat = formats.length === 1;
        let imageFormat = "1:1"; // Default to square for multiple formats

        if (isSingleFormat) {
          // Convert format like '1920x1080' to aspect ratio like '16:9'
          const [width, height] = formats[0].split("x").map(Number);
          if (width && height) {
            const aspectRatio = width / height;
            if (Math.abs(aspectRatio - 16 / 9) < 0.1) {
              imageFormat = "16:9";
            } else if (Math.abs(aspectRatio - 9 / 16) < 0.1) {
              imageFormat = "9:16";
            } else if (Math.abs(aspectRatio - 4 / 5) < 0.1) {
              imageFormat = "4:5";
            } else {
              imageFormat = "1:1"; // Default to square for non-standard ratios
            }
          }
        }

        console.log(
          `Generating image with Runware for scene ${i} with format ${imageFormat} (single format: ${isSingleFormat})`
        );
        const imageResult = await runwareService.generateImage({
          prompt,
          format: imageFormat as "1:1" | "16:9" | "9:16" | "4:5",
          numSamples: 1,
          negativePrompt: "", // Empty to avoid fluxultra error
        });

        if (!imageResult.imageURL) {
          throw new Error("Failed to generate image");
        }

        // Upload to S3
        const imageUrl = await s3Utils.downloadAndUploadToS3(
          imageResult.imageURL,
          project.userId,
          "image",
          `bulk_scene_${video.id}_${i}_${Date.now()}.jpg`
        );

        // Get the next version number
        const latestVersion = await prisma.sceneImageVersion.findFirst({
          where: { sceneId: scene.id },
          orderBy: { version: "desc" },
        });
        const nextVersion = (latestVersion?.version || 0) + 1;

        // Create image version
        await prisma.sceneImageVersion.create({
          data: {
            sceneId: scene.id,
            version: nextVersion,
            prompt,
            imageUrl,
            isActive: true,
          },
        });

        // Deactivate other versions
        await prisma.sceneImageVersion.updateMany({
          where: {
            sceneId: scene.id,
            version: { not: nextVersion },
          },
          data: { isActive: false },
        });

        // Update scene with image
        await prisma.bulkVideoScene.update({
          where: { id: scene.id },
          data: { imageUrl },
        });

        // Quality check with potential regeneration
        let finalImageUrl = imageUrl;
        let regenerationAttempts = 0;
        const maxRegenerationAttempts = 5;
        const acceptableQualityThreshold = 8; // Accept images with score 8 or higher

        while (regenerationAttempts < maxRegenerationAttempts) {
          // Perform quality analysis
          console.log("[BulkGenerator] Performing quality analysis...");
          let qualityResult = null;

          try {
            qualityResult = await analyzeImageQuality(finalImageUrl, prompt);

            console.log("[BulkGenerator] Quality analysis result:", {
              score: qualityResult.qualityScore,
              isGoodQuality: qualityResult.isGoodQuality,
              issues: qualityResult.issues,
              colorMismatch: qualityResult.colorMismatch,
            });

            // More lenient quality check - accept score 8+ or minor color mismatches
            const hasAcceptableQuality = qualityResult.qualityScore >= acceptableQualityThreshold;
            const hasMinorColorMismatch = qualityResult.colorMismatch?.severity === "minor";
            const hasCriticalColorMismatch = qualityResult.colorMismatch?.severity === "critical";
            
            if (hasAcceptableQuality || (qualityResult.qualityScore >= 7 && hasMinorColorMismatch)) {
              console.log(
                `[BulkGenerator] Image quality acceptable (score: ${qualityResult.qualityScore}/10), proceeding...`
              );
              break;
            } else if (regenerationAttempts >= maxRegenerationAttempts - 1) {
              // On last attempt, check if we should skip or continue
              console.log(
                `[BulkGenerator] Final attempt reached. Quality score: ${qualityResult.qualityScore}/10`
              );
              if (qualityResult.qualityScore < 5 || hasCriticalColorMismatch) {
                console.error(
                  `[BulkGenerator] Image quality too poor after ${maxRegenerationAttempts} attempts. Skipping this video.`
                );
                // Mark the scene as failed
                await prisma.bulkVideoScene.update({
                  where: { id: scene.id },
                  data: {
                    status: "failed",
                    error: `Image quality too poor (score: ${qualityResult.qualityScore}/10). ${
                      hasCriticalColorMismatch 
                        ? `Critical color mismatch: expected ${qualityResult.colorMismatch?.expected.join(", ")} but got ${qualityResult.colorMismatch?.found.join(", ")}` 
                        : qualityResult.issues.join(", ")
                    }`,
                  },
                });
                // Skip to next scene
                continue;
              } else {
                console.log(
                  `[BulkGenerator] Proceeding with current image despite quality issues (score: ${qualityResult.qualityScore}/10)`
                );
                break;
              }
            } else {
              const reason = hasCriticalColorMismatch
                ? `Critical color mismatch (expected: ${qualityResult.colorMismatch?.expected.join(", ")}, found: ${qualityResult.colorMismatch?.found.join(", ")})`
                : `Quality below threshold (score: ${qualityResult.qualityScore}/10, need ${acceptableQualityThreshold}+)`;
              console.log(`[BulkGenerator] ${reason}, regenerating attempt ${regenerationAttempts + 1}/${maxRegenerationAttempts}...`);
              regenerationAttempts++;

              // Improve the prompt based on quality issues
              let improvedPrompt = await this.improveScenePrompt(
                prompt,
                qualityResult.issues,
                qualityResult.suggestions,
                qualityResult.colorMismatch
              );

              // Ensure improved prompt doesn't exceed limit
              improvedPrompt = await this.optimizePromptLength(
                improvedPrompt,
                2800
              );

              // Regenerate the image using Runware directly
              console.log(
                `Regenerating image with improved prompt for scene ${i} using format ${imageFormat}`
              );
              const regeneratedImage = await runwareService.generateImage({
                prompt: improvedPrompt,
                format: imageFormat as "1:1" | "16:9" | "9:16" | "4:5",
                numSamples: 1,
                negativePrompt: "", // Empty to avoid fluxultra error
              });

              if (regeneratedImage.imageURL) {
                // Upload regenerated image to S3
                const regeneratedImageUrl = await s3Utils.downloadAndUploadToS3(
                  regeneratedImage.imageURL,
                  project.userId,
                  "image",
                  `bulk_scene_${video.id}_${i}_regen_${regenerationAttempts}_${Date.now()}.jpg`
                );

                finalImageUrl = regeneratedImageUrl;

                // Update scene with new image
                await prisma.bulkVideoScene.update({
                  where: { id: scene.id },
                  data: {
                    imageUrl: finalImageUrl,
                    prompt: improvedPrompt, // Update prompt too
                  },
                });
              }
            }
          } catch (error) {
            console.error("[BulkGenerator] Quality analysis failed:", error);
            break; // Proceed with current image if quality check fails
          }
        }

        // Analyze the final image with vision AI
        console.log("[BulkGenerator] Analyzing final image with vision AI...");
        let visionAnalysis = "";
        let animationPrompt = "";

        try {
          const visionResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/analyze-image`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageUrl: finalImageUrl,
                prompt: `Analyze this advertising scene image in detail. Describe:
1. Main subject/product and its position
2. Background and environment
3. Lighting and mood
4. Colors and visual style
5. Composition and camera angle
6. Any text or graphics visible
7. Elements that could be animated (objects, lighting, textures)
8. Overall emotional tone and message

Focus on visual elements that would benefit from subtle motion to enhance the advertising impact.`,
              }),
            }
          );

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            visionAnalysis = visionData.description || "";
            console.log("[BulkGenerator] Vision analysis completed");
          }
        } catch (error) {
          console.error("[BulkGenerator] Vision analysis failed:", error);
        }

        // Check if we should use template or AI-generated animation prompt
        const animationPromptMode =
          video.customAnimationPromptMode ||
          project.defaultAnimationPromptMode ||
          "ai";
        const animationTemplateId =
          video.customAnimationTemplate || project.defaultAnimationTemplate;

        console.log("[BulkGenerator] Animation prompt mode check:", {
          videoCustomMode: video.customAnimationPromptMode,
          projectDefaultMode: project.defaultAnimationPromptMode,
          finalMode: animationPromptMode,
          videoCustomTemplate: video.customAnimationTemplate,
          projectDefaultTemplate: project.defaultAnimationTemplate,
          finalTemplateId: animationTemplateId,
        });

        if (animationPromptMode === "template" && animationTemplateId) {
          // Use template animation prompt
          const { getAnimationPrompt } = await import(
            "@/app/utils/bulk-video/animation-templates"
          );
          animationPrompt = getAnimationPrompt(animationTemplateId);
          console.log(
            "[BulkGenerator] Using template animation prompt:",
            animationTemplateId,
            "->",
            animationPrompt
          );
        } else {
          // Generate animation prompt based on vision analysis and product type
          console.log("[BulkGenerator] Generating AI animation prompt because:", {
            isTemplateMode: animationPromptMode === "template",
            hasTemplateId: !!animationTemplateId,
            reason: animationPromptMode !== "template" ? "Not in template mode" : "No template ID selected"
          });
          animationPrompt = await this.generateAnimationPrompt(
            visionAnalysis || prompt,
            video.textContent,
            video.productImageUrl !== null,
            settings.imageStyle,
            project.defaultImageStylePreset
          );
        }

        console.log(
          "[BulkGenerator] Generated animation prompt:",
          animationPrompt
        );

        // Animate the image with the vision-enhanced prompt
        const animationResult = await unifiedAnimationService.generateAnimation(
          {
            imageUrl: finalImageUrl,
            prompt: animationPrompt,
            provider: settings.animationProvider as "runway" | "bytedance",
            duration: sceneDuration.toString() as "5" | "10",
            cameraFixed: settings.defaultCameraFixed || false,
            endImageUrl: settings.defaultUseEndImage
              ? finalImageUrl
              : undefined,
          }
        );

        if (animationResult.videoUrl) {
          // Get the next version number
          const latestAnimVersion =
            await prisma.sceneAnimationVersion.findFirst({
              where: { sceneId: scene.id },
              orderBy: { version: "desc" },
            });
          const nextAnimVersion = (latestAnimVersion?.version || 0) + 1;

          // Create animation version
          await prisma.sceneAnimationVersion.create({
            data: {
              sceneId: scene.id,
              version: nextAnimVersion,
              animationPrompt: animationPrompt,
              animationUrl: animationResult.videoUrl,
              animationProvider: settings.animationProvider,
              imageUrl: finalImageUrl,
              isActive: true,
              duration: sceneDuration,
            },
          });

          // Deactivate other animation versions
          await prisma.sceneAnimationVersion.updateMany({
            where: {
              sceneId: scene.id,
              version: { not: nextAnimVersion },
            },
            data: { isActive: false },
          });

          // Update scene with animation and animation prompt
          await prisma.bulkVideoScene.update({
            where: { id: scene.id },
            data: {
              animationUrl: animationResult.videoUrl,
              animationProvider: settings.animationProvider,
              animationPrompt: animationPrompt,
              status: "completed",
            },
          });
        } else {
          throw new Error("Failed to animate image");
        }
      } catch (error) {
        console.error(
          `Failed to generate scene ${i} for video ${video.id}:`,
          error
        );

        // Find the scene by bulkVideoId and order, then update by id
        const sceneToUpdate = await prisma.bulkVideoScene.findFirst({
          where: {
            bulkVideoId: video.id,
            order: i,
          },
        });

        if (sceneToUpdate) {
          await prisma.bulkVideoScene.update({
            where: { id: sceneToUpdate.id },
            data: {
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      }
    }

    // Check if all scenes completed successfully
    const scenes = await prisma.bulkVideoScene.findMany({
      where: { bulkVideoId: video.id },
    });

    const completedScenes = scenes.filter((s) => s.status === "completed");
    const failedScenes = scenes.filter((s) => s.status === "failed");
    const allScenesCompleted = scenes.every((s) => s.status === "completed");

    if (allScenesCompleted && completedScenes.length > 0) {
      // Update video status to completed
      await prisma.bulkVideo.update({
        where: { id: video.id },
        data: { status: "completed" },
      });
      console.log(`[BulkGenerator] Video ${video.id} completed successfully with ${completedScenes.length} scenes`);
    } else if (completedScenes.length === 0) {
      // All scenes failed - skip video entirely
      await prisma.bulkVideo.update({
        where: { id: video.id },
        data: {
          status: "failed",
          error: "All scenes failed quality checks. Manual generation required.",
        },
      });
      console.error(`[BulkGenerator] Video ${video.id} completely failed - all ${failedScenes.length} scenes failed quality checks`);
    } else {
      // Some scenes succeeded, some failed
      await prisma.bulkVideo.update({
        where: { id: video.id },
        data: {
          status: "failed",
          error: `${failedScenes.length} out of ${scenes.length} scenes failed to generate`,
        },
      });
      console.warn(`[BulkGenerator] Video ${video.id} partially failed - ${completedScenes.length} scenes completed, ${failedScenes.length} failed`);
    }
  }

  private async generateScenePrompt(
    textContent: string,
    productImageUrl: string | null,
    imageStyle: string,
    sceneIndex: number,
    totalScenes: number,
    project?: Project,
    video?: BulkVideo,
    presetId?: string | null
  ): Promise<string> {
    // Check if super minimalistic style is selected
    const isSuperMinimalistic =
      presetId === "super-minimalist" ||
      imageStyle.toLowerCase().includes("super minimal") ||
      (imageStyle.toLowerCase().includes("product only") &&
        imageStyle.toLowerCase().includes("solid"));

    console.log(
      "[BulkGenerator] generateScenePrompt - Super minimalist check:",
      {
        presetId,
        imageStyle,
        isSuperMinimalistic,
      }
    );

    // Scene types for different positions in the video
    const sceneDescriptions = isSuperMinimalistic
      ? [
          "product on solid background",
          "centered product",
          "isolated product",
          "product showcase",
        ]
      : [
          "product in context",
          "close-up details",
          "lifestyle usage",
          "hero shot",
          "product advantages",
        ];

    // Build comprehensive context from all inputs
    let contextElements: string[] = [];

    // 1. Primary: User's text content from CSV (highest priority)
    if (textContent && textContent.trim()) {
      // For super minimalistic, extract only product name
      if (isSuperMinimalistic) {
        // Try to extract product name (first few words or before "by")
        const productMatch = textContent.match(
          /^([^,.-]+?)(?:\s+by\s+|,|\.|-|$)/i
        );
        const productName = productMatch
          ? productMatch[1].trim()
          : textContent.split(" ").slice(0, 3).join(" ");
        contextElements.push(productName);
      } else {
        contextElements.push(`Main content: ${textContent}`);
      }
    }

    // 2. Project context (skip for super minimalistic)
    if (!isSuperMinimalistic && project) {
      if (
        project.name &&
        !textContent.toLowerCase().includes(project.name.toLowerCase())
      ) {
        contextElements.push(`Brand/Project: ${project.name}`);
      }
      if (project.description && project.description.trim()) {
        contextElements.push(`Context: ${project.description}`);
      }
    }

    // 3. Product image context (skip for super minimalistic)
    if (!isSuperMinimalistic && productImageUrl) {
      contextElements.push("Product photography focused");
    }

    // Combine all context
    const fullContext =
      contextElements.length > 0 ? contextElements.join(". ") : "Product";

    // Scene type for this index
    const sceneType = sceneDescriptions[sceneIndex % sceneDescriptions.length];

    // Build the final prompt with proper style layering
    const styleElements: string[] = [];

    // User's custom style (highest priority)
    if (video?.customImageStyle && video.customImageStyle.trim()) {
      styleElements.push(video.customImageStyle);
    }
    // Fallback to passed imageStyle (project default)
    else if (imageStyle && imageStyle.trim()) {
      styleElements.push(imageStyle);
    }

    // Add minimal quality indicator
    styleElements.push("professional quality");

    // Ensure centered subject for product shots
    if (productImageUrl || textContent.toLowerCase().includes("product")) {
      styleElements.push("centered product");
    }

    const finalStyle = styleElements.join(", ");

    // Try to enhance with AI if available (but skip for super minimalistic)
    if (!isSuperMinimalistic && process.env.OPENAI_API_KEY) {
      try {
        const enhancedPrompt = await this.enhancePromptWithAI(
          fullContext,
          sceneType,
          finalStyle,
          sceneIndex,
          totalScenes,
          presetId,
          productImageUrl,
          project
        );
        return enhancedPrompt;
      } catch (error) {
        console.error(
          "[BulkGenerator] Failed to enhance prompt with AI, using basic prompt:",
          error
        );
      }
    }

    // For super minimalistic, use AI to generate proper prompt
    if (isSuperMinimalistic && process.env.OPENAI_API_KEY) {
      try {
        const model = new ChatOpenAI({
          model: "chatgpt-4o-latest",
          temperature: 0.8,
        });

        const systemPrompt = `You are an expert at creating image generation prompts. You must analyze the project requirements and create a CONCISE, SPECIFIC prompt for a super minimalistic product image.

CRITICAL RULES:
1. Extract the background color from the project requirements
2. NEVER use HEX color codes in the prompt - always convert to descriptive text
3. If you see a hex color like #43B02A, convert it to a descriptive name like "vibrant green"
4. Use only color names like: red, blue, green, yellow, orange, purple, pink, brown, gray, black, white, turquoise, coral, etc.
5. Keep the prompt under 200 words
6. Focus on: product centered, solid background color, no props, ultra minimalist
7. Include the specific product name from the context`;

        const userPrompt = `Create a super minimalistic image prompt based on:

Product/Context: ${fullContext}
Project Requirements: ${project?.description || "No description"}
Style Requirements: ${finalStyle}

The prompt MUST:
- Use the EXACT background color specified in the project requirements
- Be ultra minimalistic (product only on solid color background)
- Have no props, environment, or additional elements
- Center the product with clean studio lighting`;

        const response = await model.invoke(`${systemPrompt}\n\n${userPrompt}`);
        const aiGeneratedPrompt = response.content.toString().trim();

        console.log(
          "[BulkGenerator] AI-generated super minimalist prompt:",
          aiGeneratedPrompt
        );

        return this.optimizePromptLength(aiGeneratedPrompt, 2800);
      } catch (error) {
        console.error(
          "[BulkGenerator] Failed to generate AI prompt for super minimalist, falling back:",
          error
        );
        // Fallback to basic prompt if AI fails
        const fallbackPrompt = `${fullContext}, product only on solid background color as specified in project requirements, no props, ultra minimalist`;
        return this.optimizePromptLength(fallbackPrompt, 2800);
      }
    }

    // For super minimalistic without AI, use basic prompt
    if (isSuperMinimalistic) {
      const basicPrompt = `${fullContext}, product only on solid background color as specified in project requirements, no props, no environment, no additional elements, centered composition, isolated product, clean studio lighting, ultra minimalist`;
      console.log(
        "[BulkGenerator] Using basic super minimalist prompt (no AI):",
        basicPrompt
      );
      return this.optimizePromptLength(basicPrompt, 2800);
    }

    // Fallback: Create simple prompt
    const basePrompt = `${fullContext}, ${sceneType}, ${finalStyle}`;

    // Apply preset if available
    if (presetId) {
      const preset = getPresetById(presetId);
      if (preset) {
        return this.optimizePromptLength(
          `${basePrompt}, ${preset.basePrompt}`,
          2800
        );
      }
    }

    // Ensure prompt doesn't exceed limit
    return this.optimizePromptLength(basePrompt, 2800);
  }

  private async enhancePromptWithAI(
    context: string,
    sceneType: string,
    style: string,
    sceneIndex: number,
    totalScenes: number,
    presetId?: string | null,
    productImageUrl?: string | null,
    project?: Project
  ): Promise<string> {
    // Check if super minimalistic
    const isSuperMinimalistic =
      presetId === "super-minimalist" ||
      style.toLowerCase().includes("super minimal") ||
      (style.toLowerCase().includes("product only") &&
        style.toLowerCase().includes("solid"));

    // Check if this is a category image (no product image URL)
    // productImageUrl is null or empty string when product_image column is empty in CSV
    const isCategoryImage = !productImageUrl || productImageUrl.trim() === "";

    // Note: sceneIndex and totalScenes are kept for future use in scene-specific prompting
    // Currently not used but will be helpful for creating varied scenes

    // Prepare requirements based on style and context
    const requirements: string[] = [];

    if (isSuperMinimalistic) {
      requirements.push(
        "Product MUST be placed on solid background color as specified in the project description or style requirements",
        "Background MUST be the exact solid color mentioned in the project requirements (e.g., green, blue, red, etc.)",
        "NEVER use HEX color codes - always describe colors with text names",
        "If project mentions hex color like #43B02A, convert it to descriptive name like 'vibrant green'",
        "ABSOLUTELY NO props, NO environment, NO additional elements",
        "NO decorations, accessories, or supporting elements",
        "Product isolated on plain background",
        "Centered composition",
        "Clean, even studio lighting",
        "Ultra minimalist aesthetic",
        "IMPORTANT: Extract and use the background color from the project description"
      );
    }

    // Always require unbranded products for all generated images
    requirements.push(
      "MUST AVOID any logos or brand marks on the product",
      "MUST NOT include any text or branding on the product itself",
      "Clean, unbranded product design",
      "No company names or trademarks visible",
      "Generic product representation without brand identification"
    );

    if (isCategoryImage) {
      requirements.push(
        "Generic category representation",
        "Focus on product type rather than specific brand"
      );
      console.log(
        "[BulkGenerator] Category image detected - strengthening no-logo requirements"
      );
    }

    // Log requirements for debugging
    if (requirements.length > 0) {
      console.log("[BulkGenerator] AI Enhancement Requirements:", {
        isSuperMinimalistic,
        isCategoryImage,
        requirements,
      });
    }

    const systemPrompt = `Create a concise image generation prompt for advertising. Keep it under 300 words.
${requirements.length > 0 ? `\nCRITICAL REQUIREMENTS (MUST follow these exactly):\n${requirements.map((r) => `- ${r}`).join("\n")}` : ""}

IMPORTANT RULES:
1. NEVER include brand names, logos, or trademarks in the prompt
2. Always specify "unbranded" or "generic" when describing products
3. NEVER use HEX color codes in the prompt - always use descriptive color names
4. If the project description mentions a hex color like #43B02A, convert it to a descriptive name like "vibrant green"
5. Use color names like: red, blue, green, yellow, orange, purple, pink, brown, gray, black, white, turquoise, coral, lime, navy, maroon, teal, etc.`;

    const userPrompt = `Context: ${context}
Scene: ${sceneType}
Style: ${style}
Project Description: ${project?.description || "No project description provided"}

Write a short, focused prompt for this advertising image. Include only essential details about subject, lighting, and composition. ${requirements.length > 0 ? "Ensure ALL critical requirements above are incorporated into the prompt." : ""}

If the project description specifies a background color, use that EXACT color in your prompt.`;

    const model = new ChatOpenAI({
      model: "chatgpt-4o-latest",
      temperature: 0.8,
    });

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await model.invoke(fullPrompt);
    const aiGeneratedPrompt = response.content.toString() || "";

    // Return AI prompt directly (it should already include quality standards)
    let finalPrompt = aiGeneratedPrompt;

    // Ensure prompt doesn't exceed Runware's limit (2950 chars, but we'll use 2800 for safety)
    finalPrompt = await this.optimizePromptLength(finalPrompt, 2800);

    return finalPrompt;
  }

  private async optimizePromptLength(
    prompt: string,
    maxLength: number
  ): Promise<string> {
    // If prompt is already within limit, return as is
    if (prompt.length <= maxLength) {
      return prompt;
    }

    console.log(
      `[BulkGenerator] Prompt exceeds limit (${prompt.length} > ${maxLength}), optimizing...`
    );

    // Try to optimize with AI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const optimizationPrompt = `Shorten this to under ${maxLength} characters. Keep only: product name, key style, main action. Remove all redundant words:

${prompt}

Output only the shortened prompt.`;

        const model = new ChatOpenAI({
          model: "chatgpt-4o-latest",
          temperature: 0.8,
        });

        const response = await model.invoke(optimizationPrompt);
        const optimizedPrompt = response.content.toString().trim() || "";

        if (optimizedPrompt && optimizedPrompt.length <= maxLength) {
          console.log(
            `[BulkGenerator] AI optimization successful (${optimizedPrompt.length} chars)`
          );
          return optimizedPrompt;
        }
      } catch (error) {
        console.error("[BulkGenerator] AI optimization failed:", error);
      }
    }

    // Fallback: Manual optimization by removing less essential parts
    console.log("[BulkGenerator] Using manual optimization...");

    // Remove extra whitespace and newlines
    let optimized = prompt.replace(/\s+/g, " ").trim();

    // If still too long, remove the least essential parts
    if (optimized.length > maxLength) {
      // Remove "IMPORTANT:" sections first
      optimized = optimized.replace(/IMPORTANT:.*?(?=\.|$)/gi, "").trim();
    }

    if (optimized.length > maxLength) {
      // Remove professional quality requirements section
      optimized = optimized
        .replace(/PROFESSIONAL QUALITY REQUIREMENTS:[\s\S]*?(?=\n\n|$)/, "")
        .trim();
    }

    // Final hard cut if still too long
    if (optimized.length > maxLength) {
      console.log(
        `[BulkGenerator] Hard cutting prompt to ${maxLength} characters`
      );
      optimized = optimized.substring(0, maxLength - 3) + "...";
    }

    return optimized;
  }

  private async improveScenePrompt(
    originalPrompt: string,
    issues: string[],
    suggestions: string[],
    colorMismatch?: {
      expected: string[];
      found: string[];
      severity: "critical" | "minor";
    }
  ): Promise<string> {
    console.log(
      "[BulkGenerator] Improving prompt based on quality feedback..."
    );
    console.log("[BulkGenerator] Issues found:", issues);
    if (colorMismatch) {
      console.log("[BulkGenerator] Color mismatch:", colorMismatch);
    }

    // Use AI to regenerate prompt based on quality feedback
    if (process.env.OPENAI_API_KEY) {
      try {
        const model = new ChatOpenAI({
          model: "chatgpt-4o-latest",
          temperature: 0.8,
        });

        const systemPrompt = `You are an expert at fixing image generation prompts based on quality feedback. You must analyze the issues and create an IMPROVED prompt that addresses all problems.

CRITICAL RULES:
1. Keep the core subject/product from the original prompt
2. Address EVERY issue mentioned in the feedback
3. If there's a color mismatch, ensure the new prompt specifies the EXACT expected color
4. NEVER use HEX color codes - always use descriptive color names
5. If you see hex colors like #43B02A, convert to descriptive names like "vibrant green"
6. Keep the prompt concise (under 200 words)
7. Focus on fixing the specific problems identified`;

        const userPrompt = `Original prompt: ${originalPrompt}

Quality Issues Found:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

Suggestions for Improvement:
${suggestions.map((sugg, i) => `${i + 1}. ${sugg}`).join("\n")}

${
  colorMismatch
    ? `Color Mismatch:
- Expected: ${colorMismatch.expected.join(", ")}
- Found: ${colorMismatch.found.join(", ")}
- Severity: ${colorMismatch.severity}`
    : ""
}

Create an improved prompt that fixes ALL these issues. The new prompt must:
- Address each quality issue
- Include specific color requirements if there was a color mismatch
- Ensure product completeness and structural integrity
- Maintain the original style intent`;

        const response = await model.invoke(`${systemPrompt}\n\n${userPrompt}`);
        const improvedPrompt = response.content.toString().trim();

        console.log(
          "[BulkGenerator] AI-generated improved prompt:",
          improvedPrompt
        );

        return improvedPrompt;
      } catch (error) {
        console.error(
          "[BulkGenerator] Failed to generate AI-improved prompt, falling back to manual improvements:",
          error
        );
      }
    }

    // Fallback to manual improvements if AI fails
    const qualityEnhancements: string[] = [];

    if (colorMismatch && colorMismatch.severity === "critical") {
      qualityEnhancements.push(
        "EXACTLY match the background color specified in the project requirements",
        "Use the SPECIFIC background color mentioned in the project description",
        "Background MUST be the exact solid color from the project requirements",
        "CRITICAL: Follow the color requirements from the project description",
        "Do NOT use white background unless specifically requested in the project description"
      );
    }

    // Handle product integrity issues
    const hasProductIntegrityIssues = issues.some(
      (issue) =>
        issue.toLowerCase().includes("missing") ||
        issue.toLowerCase().includes("malformed") ||
        issue.toLowerCase().includes("incomplete") ||
        issue.toLowerCase().includes("one ear") ||
        issue.toLowerCase().includes("single") ||
        issue.toLowerCase().includes("broken") ||
        issue.toLowerCase().includes("anatomically") ||
        issue.toLowerCase().includes("structurally")
    );

    if (hasProductIntegrityIssues) {
      // Add explicit product integrity requirements
      qualityEnhancements.push(
        "complete product with all parts visible",
        "anatomically correct structure",
        "realistic product proportions",
        "fully assembled product"
      );

      // Add specific fixes for common issues
      if (
        issues.some(
          (issue) =>
            issue.toLowerCase().includes("headphone") ||
            issue.toLowerCase().includes("ear")
        )
      ) {
        qualityEnhancements.push(
          "headphones with BOTH ear cups clearly visible",
          "symmetrical design"
        );
      }

      if (issues.some((issue) => issue.toLowerCase().includes("watch"))) {
        qualityEnhancements.push(
          "complete watch band",
          "properly attached watch strap"
        );
      }
    }

    // Common quality improvements
    qualityEnhancements.push(
      "ultra-high quality",
      "professional product photography",
      "photorealistic",
      "no AI artifacts"
    );

    // For product shots, emphasize centered composition
    if (originalPrompt.toLowerCase().includes("product")) {
      qualityEnhancements.push(
        "centered product",
        "product as main focus",
        "clean presentation"
      );
    }

    // Address other specific issues
    if (
      issues.some(
        (issue) =>
          issue.toLowerCase().includes("blur") ||
          issue.toLowerCase().includes("focus")
      )
    ) {
      qualityEnhancements.push(
        "crystal clear",
        "tack sharp",
        "perfect focus on product"
      );
    }

    if (issues.some((issue) => issue.toLowerCase().includes("light"))) {
      qualityEnhancements.push(
        "professional studio lighting",
        "perfectly balanced exposure"
      );
    }

    if (
      issues.some(
        (issue) =>
          issue.toLowerCase().includes("text") ||
          issue.toLowerCase().includes("garbled")
      )
    ) {
      qualityEnhancements.push("clear readable text", "crisp typography");
    }

    // Add suggestions
    suggestions.forEach((suggestion) => {
      if (
        suggestion.toLowerCase().includes("complete") ||
        suggestion.toLowerCase().includes("all parts")
      ) {
        qualityEnhancements.push(
          "show complete product",
          "all components visible"
        );
      }
    });

    // Construct improved prompt
    const enhancementsString = qualityEnhancements.join(", ");

    // If color mismatch is critical, put color requirements first
    if (colorMismatch && colorMismatch.severity === "critical") {
      const colorEnhancements = qualityEnhancements.filter(
        (e) =>
          e.toLowerCase().includes("background") ||
          e.toLowerCase().includes("color") ||
          e.toLowerCase().includes("hex")
      );
      const otherEnhancements = qualityEnhancements.filter(
        (e) =>
          !e.toLowerCase().includes("background") &&
          !e.toLowerCase().includes("color") &&
          !e.toLowerCase().includes("hex")
      );

      // Place color requirements at the beginning
      return `${colorEnhancements.join(", ")}, ${originalPrompt}, ${otherEnhancements.join(", ")}`;
    }

    return `${originalPrompt}, ${enhancementsString}`;
  }

  private async generateAnimationPrompt(
    visionAnalysis: string,
    productText: string,
    isProductImage: boolean,
    imageStyle: string,
    presetId?: string | null
  ): Promise<string> {
    // Check if it's super minimalistic (product only on solid background)
    const isSuperMinimalistic =
      presetId === "super-minimalist" ||
      imageStyle.toLowerCase().includes("super minimal") ||
      (imageStyle.toLowerCase().includes("product only") &&
        imageStyle.toLowerCase().includes("solid")) ||
      visionAnalysis.toLowerCase().includes("product only") ||
      visionAnalysis.toLowerCase().includes("solid color background") ||
      visionAnalysis.toLowerCase().includes("solid background");

    // For super minimalistic, use simple predefined animations
    if (isSuperMinimalistic) {
      const superMinimalAnimations = [
        "Static camera, simple side-to-side rotation of 30 degrees total, smooth and continuous",
        "Fixed camera, gentle left-to-right rotation, 15 degrees each direction",
        "Stationary view, slow horizontal rotation from -20 to +20 degrees",
        "No camera movement, product rotates side to side showing left and right profiles",
        "Fixed perspective, smooth pendulum rotation left to right, 25 degrees total",
      ];
      return superMinimalAnimations[
        Math.floor(Math.random() * superMinimalAnimations.length)
      ];
    }

    // For all other cases, use AI to generate perfect animation prompt based on vision analysis
    if (
      process.env.OPENAI_API_KEY &&
      visionAnalysis &&
      visionAnalysis.length > 50
    ) {
      try {
        console.log(
          "[BulkGenerator] Generating AI-powered animation prompt based on vision analysis"
        );

        const model = new ChatOpenAI({
          model: "chatgpt-4o-latest",
          temperature: 0.8,
        });

        // Determine style-specific animation guidelines
        let styleGuidelines = "";

        const lowerStyle = imageStyle.toLowerCase();
        if (
          lowerStyle.includes("minimalist") ||
          lowerStyle.includes("minimal") ||
          lowerStyle.includes("clean")
        ) {
          styleGuidelines = `
STYLE REQUIREMENTS - MINIMALIST:
- Use subtle, elegant movements only
- Prefer slow zooms or gentle parallax effects
- Keep camera movements minimal and smooth
- Focus on simple product tilts (10-15 degrees max) or lighting shifts
- Avoid dramatic or complex animations
- Emphasize stillness with minimal motion accents`;
        } else if (
          lowerStyle.includes("luxury") ||
          lowerStyle.includes("premium") ||
          lowerStyle.includes("elegant")
        ) {
          styleGuidelines = `
STYLE REQUIREMENTS - LUXURY/PREMIUM:
- Use smooth, cinematic camera movements
- Employ subtle depth of field changes
- Include graceful product reveals or gentle tilts (10-20 degrees max)
- Add sophisticated lighting transitions
- Keep movements refined and purposeful
- Focus on highlighting premium details and textures`;
        } else if (
          lowerStyle.includes("dynamic") ||
          lowerStyle.includes("energetic") ||
          lowerStyle.includes("vibrant")
        ) {
          styleGuidelines = `
STYLE REQUIREMENTS - DYNAMIC/ENERGETIC:
- Use bold camera movements and transitions
- Include dynamic zooms and pans
- Add energetic parallax effects
- Incorporate quick cuts or speed ramps
- Emphasize movement and action
- Create visual excitement and momentum`;
        } else if (
          lowerStyle.includes("lifestyle") ||
          lowerStyle.includes("natural") ||
          lowerStyle.includes("authentic")
        ) {
          styleGuidelines = `
STYLE REQUIREMENTS - LIFESTYLE/NATURAL:
- Use organic, handheld-style movements
- Include ambient environmental motion
- Add natural elements like light flares or particles
- Keep movements fluid and lifelike
- Focus on creating authentic moments
- Emphasize natural flow and rhythm`;
        } else if (
          lowerStyle.includes("tech") ||
          lowerStyle.includes("futuristic") ||
          lowerStyle.includes("modern")
        ) {
          styleGuidelines = `
STYLE REQUIREMENTS - TECH/MODERN:
- Use precise, geometric camera movements
- Include digital effects or glitch transitions
- Add sleek product rotations or reveals
- Employ sharp, clean transitions
- Focus on precision and innovation
- Emphasize technological sophistication`;
        } else if (
          lowerStyle.includes("vintage") ||
          lowerStyle.includes("retro") ||
          lowerStyle.includes("classic")
        ) {
          styleGuidelines = `
STYLE REQUIREMENTS - VINTAGE/RETRO:
- Use nostalgic camera techniques
- Include film-style movements or transitions
- Add subtle grain or light leak effects
- Keep movements classic and timeless
- Focus on evoking nostalgia
- Emphasize warmth and character`;
        }

        const systemPrompt = `You are an expert at creating animation prompts for advertising videos. Based on the detailed vision analysis of an image, create a perfect animation prompt that will enhance the advertising impact.

Consider:
1. The specific elements visible in the image
2. The composition and camera angle already present
3. The mood and emotional tone
4. The product/subject positioning
5. Any unique visual opportunities for motion
${styleGuidelines}

CRITICAL ROTATION RULES:
- NEVER use rotations beyond 20 degrees in any direction
- Keep ALL rotations between 10-20 degrees maximum
- Product must ALWAYS remain front-facing (never show back or sides)
- Use terms like "gentle tilt", "subtle wobble", "slight sway" instead of "rotation" or "turn"
- Prefer 10-15 degree movements to keep the front view visible
- NEVER show the backside or profile view of the product

Create a SHORT, SPECIFIC animation prompt (max 30 words) that describes camera movement, subject animation, and any atmospheric effects that would enhance this specific image while respecting the style requirements.`;

        const userPrompt = `Image Analysis:
${visionAnalysis}

Product/Context: ${productText}
Style: ${imageStyle}

Create the perfect animation prompt for this specific image that will make it an engaging advertisement. The animation MUST match the ${imageStyle} style guidelines.`;

        const response = await model.invoke(`${systemPrompt}\n\n${userPrompt}`);
        const aiGeneratedPrompt = response.content.toString().trim();

        console.log(
          "[BulkGenerator] AI-generated animation prompt:",
          aiGeneratedPrompt
        );

        // Ensure the prompt is concise
        if (aiGeneratedPrompt && aiGeneratedPrompt.length > 0) {
          return aiGeneratedPrompt;
        }
      } catch (error) {
        console.error(
          "[BulkGenerator] Failed to generate AI animation prompt:",
          error
        );
      }
    }

    // Fallback to smart template selection based on vision analysis
    const isMinimalistic =
      imageStyle.toLowerCase().includes("minimal") ||
      imageStyle.toLowerCase().includes("clean") ||
      imageStyle.toLowerCase().includes("simple") ||
      visionAnalysis.toLowerCase().includes("minimalist") ||
      visionAnalysis.toLowerCase().includes("clean background") ||
      visionAnalysis.toLowerCase().includes("white background");

    const isProductFocused =
      isProductImage ||
      visionAnalysis.toLowerCase().includes("product") ||
      visionAnalysis.toLowerCase().includes("item") ||
      visionAnalysis.toLowerCase().includes("object") ||
      productText.toLowerCase().includes("product");

    if (isMinimalistic && isProductFocused) {
      const minimalAnimations = [
        "Subtle zoom in with gentle 10-degree tilt, product stays front-facing",
        "Gentle parallax effect with slight depth, product wobbles 15 degrees maximum",
        "Smooth 10-20 degree sway left to right with soft lighting shift",
        "Minimal camera drift with subtle focus pull, product tilts 10 degrees only",
        "Static shot with gentle lighting sweep, product slightly rocks 10-15 degrees",
      ];
      return minimalAnimations[
        Math.floor(Math.random() * minimalAnimations.length)
      ];
    } else if (isProductFocused) {
      const productAnimations = [
        "Camera slowly moves 15 degrees, product tilts slightly maintaining front view",
        "Smooth zoom with product swaying 10-15 degrees to highlight features",
        "Cinematic dolly shot with product tilting 10 degrees, shallow depth",
        "Dynamic lighting shift as product gently wobbles 10-20 degrees",
        "Parallax movement with product rocking 15 degrees maximum, always front-facing",
      ];
      return productAnimations[
        Math.floor(Math.random() * productAnimations.length)
      ];
    } else {
      const sceneAnimations = [
        "Cinematic camera movement through the scene with smooth transitions",
        "Atmospheric effects with subtle particle movement and lighting changes",
        "Dynamic parallax with multiple depth layers creating immersive motion",
        "Sweeping camera pan revealing the full scene composition",
        "Ambient movement with natural elements like fabric, smoke, or water",
      ];
      return sceneAnimations[
        Math.floor(Math.random() * sceneAnimations.length)
      ];
    }
  }

  async regenerateScene(sceneId: string): Promise<void> {
    const scene = await prisma.bulkVideoScene.findUnique({
      where: { id: sceneId },
      include: { bulkVideo: { include: { project: true } } },
    });

    if (!scene) {
      throw new Error("Scene not found");
    }

    const project = scene.bulkVideo.project;
    const settings = {
      animationProvider:
        scene.bulkVideo.customAnimationProvider ||
        project.defaultAnimationProvider ||
        "runway",
      duration: Math.floor(
        (scene.bulkVideo.customDuration || project.defaultDuration || 15) /
          (scene.bulkVideo.customSceneCount || project.defaultSceneCount || 3)
      ),
      imageStyle:
        scene.bulkVideo.customImageStyle ||
        project.defaultImageStyle ||
        "modern product photography",
      defaultCameraFixed:
        scene.bulkVideo.customCameraFixed ??
        project.defaultCameraFixed ??
        false,
      defaultUseEndImage:
        scene.bulkVideo.customUseEndImage ??
        project.defaultUseEndImage ??
        false,
    };

    // Update status
    await prisma.bulkVideoScene.update({
      where: { id: sceneId },
      data: { status: "generating" },
    });

    try {
      // Determine image format based on selected formats
      const formats =
        scene.bulkVideo.customFormats.length > 0
          ? scene.bulkVideo.customFormats
          : project.defaultFormats || ["9x16"];
      const isSingleFormat = formats.length === 1;
      let imageFormat = "1:1"; // Default to square for multiple formats

      if (isSingleFormat) {
        // Convert format like '1920x1080' to aspect ratio like '16:9'
        const [width, height] = formats[0].split("x").map(Number);
        if (width && height) {
          const aspectRatio = width / height;
          if (Math.abs(aspectRatio - 16 / 9) < 0.1) {
            imageFormat = "16:9";
          } else if (Math.abs(aspectRatio - 9 / 16) < 0.1) {
            imageFormat = "9:16";
          } else if (Math.abs(aspectRatio - 4 / 5) < 0.1) {
            imageFormat = "4:5";
          } else {
            imageFormat = "1:1"; // Default to square for non-standard ratios
          }
        }
      }

      // Generate new image using Runware directly
      console.log(
        `[BulkGenerator] Regenerating scene image with Runware using format ${imageFormat}`
      );
      const imageResult = await runwareService.generateImage({
        prompt: scene.prompt,
        format: imageFormat as "1:1" | "16:9" | "9:16" | "4:5",
        numSamples: 1,
        negativePrompt: "", // Empty to avoid fluxultra error
      });

      if (!imageResult.imageURL) {
        throw new Error("Failed to generate image");
      }

      // Upload to S3
      const imageUrl = await s3Utils.downloadAndUploadToS3(
        imageResult.imageURL,
        scene.bulkVideo.project.userId,
        "image",
        `bulk_scene_regen_${sceneId}_${Date.now()}.jpg`
      );

      // Get the next version number
      const latestVersion = await prisma.sceneImageVersion.findFirst({
        where: { sceneId: sceneId },
        orderBy: { version: "desc" },
      });
      const nextVersion = (latestVersion?.version || 0) + 1;

      // Create new image version
      await prisma.sceneImageVersion.create({
        data: {
          sceneId: sceneId,
          version: nextVersion,
          prompt: scene.prompt,
          imageUrl,
          isActive: true,
        },
      });

      // Deactivate other versions
      await prisma.sceneImageVersion.updateMany({
        where: {
          sceneId: sceneId,
          version: { not: nextVersion },
        },
        data: { isActive: false },
      });

      // Update with new image
      await prisma.bulkVideoScene.update({
        where: { id: sceneId },
        data: {
          imageUrl,
          status: "completed",
        },
      });

      // Analyze the new image with vision AI
      console.log(
        "[BulkGenerator] Analyzing regenerated image with vision AI..."
      );
      let visionAnalysis = "";
      let animationPrompt = "";

      try {
        const visionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/analyze-image`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl,
              prompt: `Analyze this advertising scene image in detail. Describe:
1. Main subject/product and its position
2. Background and environment
3. Lighting and mood
4. Colors and visual style
5. Composition and camera angle
6. Any text or graphics visible
7. Elements that could be animated (objects, lighting, textures)
8. Overall emotional tone and message

Focus on visual elements that would benefit from subtle motion to enhance the advertising impact.`,
            }),
          }
        );

        if (visionResponse.ok) {
          const visionData = await visionResponse.json();
          visionAnalysis = visionData.description || "";
          console.log(
            "[BulkGenerator] Vision analysis completed for regenerated scene"
          );
        }
      } catch (error) {
        console.error("[BulkGenerator] Vision analysis failed:", error);
      }

      // Check if we should use template or AI-generated animation prompt
      const animationPromptMode =
        scene.bulkVideo.customAnimationPromptMode ||
        scene.bulkVideo.project.defaultAnimationPromptMode ||
        "ai";
      const animationTemplateId =
        scene.bulkVideo.customAnimationTemplate ||
        scene.bulkVideo.project.defaultAnimationTemplate;

      if (animationPromptMode === "template" && animationTemplateId) {
        // Use template animation prompt
        const { getAnimationPrompt } = await import(
          "@/app/utils/bulk-video/animation-templates"
        );
        animationPrompt = getAnimationPrompt(animationTemplateId);
        console.log(
          "[BulkGenerator] Using template animation prompt for regenerated scene:",
          animationTemplateId,
          "->",
          animationPrompt
        );
      } else {
        // Generate animation prompt based on vision analysis
        animationPrompt = await this.generateAnimationPrompt(
          visionAnalysis || scene.prompt,
          scene.bulkVideo.textContent,
          scene.bulkVideo.productImageUrl !== null,
          settings.imageStyle,
          scene.bulkVideo.project.defaultImageStylePreset
        );
      }

      console.log(
        "[BulkGenerator] Generated animation prompt for regenerated scene:",
        animationPrompt
      );

      // Animate the new image with vision-enhanced prompt
      const animationResult = await unifiedAnimationService.generateAnimation({
        imageUrl,
        prompt: animationPrompt,
        provider: settings.animationProvider as "runway" | "bytedance",
        duration: settings.duration.toString() as "5" | "10",
        cameraFixed: settings.defaultCameraFixed || false,
        endImageUrl: settings.defaultUseEndImage ? imageUrl : undefined,
      });

      if (animationResult.videoUrl) {
        // Get the next version number
        const latestAnimVersion = await prisma.sceneAnimationVersion.findFirst({
          where: { sceneId: sceneId },
          orderBy: { version: "desc" },
        });
        const nextAnimVersion = (latestAnimVersion?.version || 0) + 1;

        // Create new animation version
        await prisma.sceneAnimationVersion.create({
          data: {
            sceneId: sceneId,
            version: nextAnimVersion,
            animationPrompt: animationPrompt,
            animationUrl: animationResult.videoUrl,
            animationProvider: settings.animationProvider,
            imageUrl,
            isActive: true,
            duration: settings.duration,
          },
        });

        // Deactivate other animation versions
        await prisma.sceneAnimationVersion.updateMany({
          where: {
            sceneId: sceneId,
            version: { not: nextAnimVersion },
          },
          data: { isActive: false },
        });

        await prisma.bulkVideoScene.update({
          where: { id: sceneId },
          data: {
            animationUrl: animationResult.videoUrl,
            animationPrompt: animationPrompt,
            status: "completed",
          },
        });
      } else {
        throw new Error("Failed to animate image");
      }
    } catch (error) {
      await prisma.bulkVideoScene.update({
        where: { id: sceneId },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  }

  async regenerateAnimation(
    sceneId: string,
    provider?: "runway" | "bytedance",
    customAnimationPrompt?: string
  ): Promise<void> {
    const scene = await prisma.bulkVideoScene.findUnique({
      where: { id: sceneId },
      include: { bulkVideo: { include: { project: true } } },
    });

    if (!scene || !scene.imageUrl) {
      throw new Error("Scene or image not found");
    }

    const project = scene.bulkVideo.project;
    const animationProvider =
      provider ||
      scene.bulkVideo.customAnimationProvider ||
      project.defaultAnimationProvider ||
      "runway";

    const duration = Math.floor(
      (scene.bulkVideo.customDuration || project.defaultDuration || 15) /
        (scene.bulkVideo.customSceneCount || project.defaultSceneCount || 3)
    );

    const imageStyle =
      scene.bulkVideo.customImageStyle ||
      project.defaultImageStyle ||
      "modern product photography";

    try {
      // Analyze the image with vision AI to get better animation prompt
      console.log(
        "[BulkGenerator] Analyzing image for animation regeneration..."
      );
      let visionAnalysis = "";
      let animationPrompt = scene.prompt; // Default to scene prompt

      // Use custom prompt if provided
      if (customAnimationPrompt) {
        animationPrompt = customAnimationPrompt;
        console.log(
          "[BulkGenerator] Using custom animation prompt:",
          animationPrompt
        );
      } else {
        // Check if we should use template or AI-generated animation prompt
        const animationPromptMode =
          scene.bulkVideo.customAnimationPromptMode ||
          project.defaultAnimationPromptMode ||
          "ai";
        const animationTemplateId =
          scene.bulkVideo.customAnimationTemplate ||
          project.defaultAnimationTemplate;

        console.log("[BulkGenerator] Regeneration - Animation prompt mode check:", {
          videoCustomMode: scene.bulkVideo.customAnimationPromptMode,
          projectDefaultMode: project.defaultAnimationPromptMode,
          finalMode: animationPromptMode,
          videoCustomTemplate: scene.bulkVideo.customAnimationTemplate,
          projectDefaultTemplate: project.defaultAnimationTemplate,
          finalTemplateId: animationTemplateId,
        });

        if (animationPromptMode === "template" && animationTemplateId) {
          // Use template animation prompt
          const { getAnimationPrompt } = await import(
            "@/app/utils/bulk-video/animation-templates"
          );
          animationPrompt = getAnimationPrompt(animationTemplateId);
          console.log(
            "[BulkGenerator] Using template animation prompt for regeneration:",
            animationTemplateId,
            "->",
            animationPrompt
          );
        } else {
          // Generate animation prompt automatically with AI
          try {
          const visionResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/analyze-image`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageUrl: scene.imageUrl,
                prompt: `Analyze this advertising scene image in detail. Describe:
1. Main subject/product and its position
2. Background and environment
3. Lighting and mood
4. Colors and visual style
5. Composition and camera angle
6. Any text or graphics visible
7. Elements that could be animated (objects, lighting, textures)
8. Overall emotional tone and message

Focus on visual elements that would benefit from subtle motion to enhance the advertising impact.`,
              }),
            }
          );

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            visionAnalysis = visionData.description || "";
            console.log(
              "[BulkGenerator] Vision analysis completed for animation regeneration"
            );

            // Generate better animation prompt based on vision analysis
            animationPrompt = await this.generateAnimationPrompt(
              visionAnalysis,
              scene.bulkVideo.textContent,
              scene.bulkVideo.productImageUrl !== null,
              imageStyle,
              scene.bulkVideo.project.defaultImageStylePreset
            );

            console.log(
              "[BulkGenerator] Generated new animation prompt:",
              animationPrompt
            );
          }
          } catch (error) {
            console.error(
              "[BulkGenerator] Vision analysis failed, using original prompt:",
              error
            );
          }
        }
      }

      const animationResult = await unifiedAnimationService.generateAnimation({
        imageUrl: scene.imageUrl,
        prompt: animationPrompt,
        provider: animationProvider as "runway" | "bytedance",
        duration: duration.toString() as "5" | "10",
        cameraFixed: scene.bulkVideo.project.defaultCameraFixed || false,
        endImageUrl: scene.bulkVideo.project.defaultUseEndImage
          ? scene.imageUrl
          : undefined,
      });

      if (animationResult.videoUrl) {
        // Get the next version number
        const latestAnimVersion = await prisma.sceneAnimationVersion.findFirst({
          where: { sceneId: sceneId },
          orderBy: { version: "desc" },
        });
        const nextAnimVersion = (latestAnimVersion?.version || 0) + 1;

        // Create new animation version
        await prisma.sceneAnimationVersion.create({
          data: {
            sceneId: sceneId,
            version: nextAnimVersion,
            animationPrompt: animationPrompt,
            animationUrl: animationResult.videoUrl,
            animationProvider: animationProvider,
            imageUrl: scene.imageUrl!,
            isActive: true,
            duration,
          },
        });

        // Deactivate other animation versions
        await prisma.sceneAnimationVersion.updateMany({
          where: {
            sceneId: sceneId,
            version: { not: nextAnimVersion },
          },
          data: { isActive: false },
        });

        await prisma.bulkVideoScene.update({
          where: { id: sceneId },
          data: {
            animationUrl: animationResult.videoUrl,
            animationProvider,
            animationPrompt: animationPrompt,
            status: "completed",
          },
        });
      } else {
        throw new Error("Failed to animate image");
      }
    } catch (error) {
      await prisma.bulkVideoScene.update({
        where: { id: sceneId },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  }
}
