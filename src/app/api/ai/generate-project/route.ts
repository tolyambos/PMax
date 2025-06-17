import { NextResponse } from "next/server";
import { openAIService } from "@/app/utils/openai";
import { runwareService } from "@/app/utils/runware";
import { s3Utils } from "@/lib/s3-utils";
import { z } from "zod";
import {
  ANALYZE_AD_REQUEST_PROMPT,
  GENERATE_STORYBOARD_PROMPT,
  FALLBACK_STORYBOARD_PROMPT,
} from "@/app/utils/prompts";

// Define project schema
const ProjectRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  adType: z.string().min(1),
  productName: z.string().min(1),
  targetAudience: z.string().optional(),
  keyPoints: z.string().optional(),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  style: z.string(),
  numScenes: z.number().int().min(1).max(5),
  totalDuration: z.number().int().min(1).max(25).optional().default(15), // Total video duration in seconds
  // Animation settings
  animateAllScenes: z.boolean().optional().default(false),
  animationProvider: z
    .enum(["bytedance", "runway"])
    .optional()
    .default("bytedance"),
  // Product-specific fields
  productImages: z
    .array(
      z.object({
        url: z.string(),
        visionAnalysis: z.string(),
      })
    )
    .optional(),
  isProductVideo: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    // Parse request
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Log the request
    console.log("Project generation request:", {
      ...body,
      animationDetails: {
        animateAllScenes: body.animateAllScenes,
        animationProvider: body.animationProvider,
        adType: body.adType,
        isProductVideo: body.isProductVideo,
      },
    });

    // Validate request
    try {
      body = ProjectRequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

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

    // Extract parameters
    const {
      name,
      description,
      adType,
      productName,
      targetAudience,
      keyPoints,
      format,
      style,
      numScenes,
      totalDuration,
      productImages,
      isProductVideo,
    } = body;

    // Prepare a comprehensive analysis of the user's inputs
    console.log("Analyzing user inputs for customized scene generation...");

    // Create a complete analysis prompt that captures all user inputs
    const analysisPrompt = ANALYZE_AD_REQUEST_PROMPT(
      productName,
      adType,
      targetAudience || "general audience",
      keyPoints || "",
      style,
      format,
      numScenes,
      totalDuration
    );

    console.log(
      "Using OpenAI to analyze user inputs with comprehensive approach"
    );

    // 1. Generate ad concept and scene descriptions with total duration constraint
    const adConcept = await generateAdConcept(
      adType,
      productName,
      targetAudience || "general audience",
      keyPoints || "",
      numScenes,
      totalDuration,
      analysisPrompt, // Pass the comprehensive analysis prompt
      productImages, // Pass all product images with vision analysis
      isProductVideo // Flag for product video type
    );

    // Import Prisma client
    const { prisma } = await import("@/app/utils/db");

    // For development, use a fixed user ID but ensure the user exists
    let userId = "dev-user-id";

    // Ensure the dev user exists in the database
    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          name: "Development User",
          email: "dev@pmax.local",
        },
      });
      console.log(`Ensured dev user exists: ${userId}`);
    } catch (userError) {
      console.error("Error ensuring dev user exists:", userError);
      // Try with a different approach - find or create by email
      try {
        const existingUser = await prisma.user.findFirst({
          where: { email: "dev@pmax.local" },
        });

        if (existingUser) {
          userId = existingUser.id;
          console.log(`Using existing dev user: ${userId}`);
        } else {
          const newUser = await prisma.user.create({
            data: {
              name: "Development User",
              email: "dev@pmax.local",
            },
          });
          userId = newUser.id;
          console.log(`Created new dev user: ${userId}`);
        }
      } catch (fallbackError) {
        console.error("Error creating/finding dev user:", fallbackError);
        throw new Error("Unable to establish user for project creation");
      }
    }

    // 2. Generate images for scenes using Runware and upload to S3
    const scenes = await generateScenesFromConcept(
      adConcept,
      format,
      style,
      userId,
      productImages, // Pass all product images for Flux Kontext
      isProductVideo // Pass product video flag
    );

    // Log what we're returning
    console.log(`Returning ${scenes.length} generated scenes to client`);

    // 3. Create the project in the database

    // In production, implement proper authentication check here
    if (process.env.NODE_ENV !== "development") {
      // For now, return an error in production until auth is implemented
      return NextResponse.json(
        { error: "Authentication required", success: false },
        { status: 401 }
      );
    }

    // Use Prisma transaction to ensure data consistency
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        console.log("Starting database transaction for project creation");

        // Create the project record
        const projectData = {
          name,
          description: description || "",
          format,
          userId,
          prompt: JSON.stringify(adConcept),
        };

        console.log("Creating project with data:", {
          name: projectData.name,
          format: projectData.format,
          userId: projectData.userId,
          hasDescription: !!projectData.description,
          hasPrompt: !!projectData.prompt,
        });

        const project = await tx.project.create({
          data: projectData,
        });

        console.log(`Successfully created project with ID: ${project.id}`);

        // Create all scenes in the same transaction
        const createdScenes = [];
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          try {
            // Validate scene data before creating
            const sceneData = {
              projectId: project.id,
              order: i,
              duration: Math.max(1, Math.min(scene.duration || 3, 25)), // Ensure duration is between 1-25 seconds
              imageUrl: scene.imageUrl || null, // Use null instead of empty string
              prompt: scene.prompt || null, // Use null instead of empty string
              animationStatus: null, // Initialize as null
              animationPrompt: null, // Initialize as null
              videoUrl: null, // Initialize as null
            };

            console.log(`Creating scene ${i + 1}/${scenes.length} with data:`, {
              order: sceneData.order,
              duration: sceneData.duration,
              hasImageUrl: !!sceneData.imageUrl,
              hasPrompt: !!sceneData.prompt,
            });

            const createdScene = await tx.scene.create({
              data: sceneData,
              // Explicitly select fields to ensure they're returned
              select: {
                id: true,
                projectId: true,
                imageUrl: true,
                prompt: true,
                duration: true,
                order: true,
                animationStatus: true,
                videoUrl: true,
              },
            });

            createdScenes.push(createdScene);
            console.log(
              `Successfully created scene ${i + 1}/${scenes.length} with ID: ${createdScene.id}, imageUrl: ${createdScene.imageUrl?.substring(0, 50)}...`
            );
          } catch (error) {
            console.error(`Error creating scene ${i + 1}:`, error);
            console.log(
              "Failed scene data:",
              JSON.stringify(
                {
                  projectId: project.id,
                  order: i,
                  duration: scene.duration,
                  imageUrl: scene.imageUrl,
                  prompt: scene.prompt,
                },
                null,
                2
              )
            );
            throw error; // Re-throw to abort transaction
          }
        }

        return { project, scenes: createdScenes };
      });
    } catch (transactionError) {
      console.error("Database transaction failed:", transactionError);

      // Check if it's a PostgreSQL constraint violation or other database error
      if (transactionError instanceof Error) {
        if (transactionError.message.includes("foreign key constraint")) {
          throw new Error("Invalid user reference. Please contact support.");
        } else if (transactionError.message.includes("unique constraint")) {
          throw new Error("A project with this name already exists.");
        } else if (transactionError.message.includes("25P02")) {
          throw new Error("Database transaction aborted. Please try again.");
        }
      }

      // Re-throw the original error if we don't have a specific handler
      throw transactionError;
    }

    const project = result.project;
    const createdScenes = result.scenes;

    // 4. Generate animations for all scenes if requested
    if (body.animateAllScenes) {
      console.log(
        `🎬 Starting animation generation for all ${createdScenes.length} scenes using ${body.animationProvider}`
      );

      // Debug log to check scene data
      console.log(
        "Created scenes data:",
        createdScenes.map((s) => ({
          id: s.id,
          hasImageUrl: !!s.imageUrl,
          imageUrlPreview: s.imageUrl?.substring(0, 50) + "...",
        }))
      );

      // Import animation service
      const { unifiedAnimationService } = await import(
        "@/app/utils/animation-service"
      );

      // Generate animations for all scenes in parallel
      const animationPromises = createdScenes.map(async (scene, index) => {
        try {
          console.log(
            `🎬 Generating animation for scene ${index + 1}/${createdScenes.length}`
          );

          // Check if scene has a valid image URL
          if (!scene.imageUrl) {
            console.error(
              `❌ Scene ${index + 1} has no imageUrl, skipping animation`
            );
            return {
              sceneId: scene.id,
              error: "No image URL available for animation",
            };
          }

          // Use the scene prompt directly for animation
          const animationPrompt = scene.prompt || "animate this scene";
          console.log(
            `🎬 Using scene prompt for animation ${index + 1}: ${animationPrompt.substring(0, 100)}...`
          );

          // Generate presigned URL for Bytedance to access the image
          let publicImageUrl = scene.imageUrl;
          try {
            // Import S3 utils
            const { s3Utils } = await import("@/lib/s3-utils");

            // Check if this is an S3 URL that needs a presigned URL
            const isS3Url =
              scene.imageUrl.includes("wasabisys.com") ||
              scene.imageUrl.includes("amazonaws.com") ||
              scene.imageUrl.includes("s3.");

            if (isS3Url) {
              console.log(
                `🔗 Generating presigned URL for scene ${index + 1} animation`
              );

              // Extract bucket and key from the URL
              const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(
                scene.imageUrl
              );

              // Generate presigned URL for animation processing
              publicImageUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);

              console.log(
                `✅ Generated presigned URL for scene ${index + 1}: ${publicImageUrl.substring(0, 100)}...`
              );
            }
          } catch (s3Error) {
            console.error(
              `❌ Failed to generate presigned URL for scene ${index + 1}:`,
              s3Error
            );
            // Continue with original URL and let Bytedance try to access it
          }

          // Generate the animation directly using the service (bypass API authentication)
          let animationResult;
          if (body.animationProvider === "bytedance") {
            // Import and use Bytedance service directly
            const { bytedanceAnimationService } = await import(
              "@/app/utils/bytedance-animation"
            );

            const bytedanceResult =
              await bytedanceAnimationService.generateAnimation({
                imageUrl: publicImageUrl,
                prompt: animationPrompt,
                resolution: "720p",
                duration: "5",
                cameraFixed: false,
              });

            animationResult = {
              videoUrl: bytedanceResult.videoUrl,
              provider: "bytedance" as const,
              cost: bytedanceResult.cost,
              metadata: {
                seed: bytedanceResult.seed,
                duration: "5",
                resolution: "720p",
              },
            };
          } else {
            // For other providers, use the unified service
            animationResult = await unifiedAnimationService.generateAnimation({
              imageUrl: publicImageUrl,
              prompt: animationPrompt,
              provider: body.animationProvider,
              // Bytedance-specific options
              resolution: "720p",
              duration: scene.duration > 7 ? "10" : "5",
              cameraFixed: false,
            });
          }

          // Update the scene with animation data
          await prisma.scene.update({
            where: { id: scene.id },
            data: {
              videoUrl: animationResult.videoUrl,
              animationStatus: "completed",
              animationPrompt: animationPrompt,
              animate: true,
              useAnimatedVersion: true,
            },
          });

          console.log(
            `✅ Completed animation for scene ${index + 1}: ${animationResult.videoUrl.substring(0, 100)}...`
          );

          return {
            sceneId: scene.id,
            videoUrl: animationResult.videoUrl,
            provider: animationResult.provider,
            cost: animationResult.cost,
          };
        } catch (error) {
          console.error(
            `❌ Failed to generate animation for scene ${index + 1}:`,
            error
          );
          return {
            sceneId: scene.id,
            error:
              error instanceof Error
                ? error.message
                : "Animation generation failed",
          };
        }
      });

      // Wait for all animations to complete
      try {
        const animationResults = await Promise.all(animationPromises);
        const successfulAnimations = animationResults.filter(
          (result) => !result.error
        );
        const failedAnimations = animationResults.filter(
          (result) => result.error
        );

        console.log(
          `🎉 Animation generation complete! ${successfulAnimations.length} successful, ${failedAnimations.length} failed`
        );

        if (failedAnimations.length > 0) {
          console.warn("Failed animations:", failedAnimations);
        }
      } catch (error) {
        console.error("❌ Animation generation batch failed:", error);
        // Don't fail the entire project creation if animations fail
      }
    }

    // 5. Return the project data with clear success flag
    console.log(
      `Returning project ID: ${project.id} to client for redirection`
    );
    return NextResponse.json({
      projectId: project.id,
      name,
      description,
      format,
      scenes,
      adConcept,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating project:", error);

    // Determine status code and message based on error
    const isClientError =
      error instanceof Error &&
      (error.message.includes("Invalid") || error.message.includes("required"));

    return NextResponse.json(
      {
        error: isClientError ? error.message : "Failed to generate project",
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: isClientError ? 400 : 500 }
    );
  }
}

/**
 * Generate ad concept and scene descriptions based on user inputs
 */
async function generateAdConcept(
  adType: string,
  productName: string,
  targetAudience: string,
  keyPoints: string,
  numScenes: number,
  totalDuration: number = 15, // Default to 15 seconds if not provided
  analysisPrompt: string = "", // New parameter for comprehensive AI analysis
  productImages: Array<{ url: string; visionAnalysis: string }> = [], // Product images with vision analysis
  isProductVideo: boolean = false // Flag for product video type
): Promise<any> {
  try {
    // Generate ad concept using OpenAI (this would be the actual implementation)
    // For now, we'll create a mock implementation

    // Enhanced prompt generation with vision analysis for product videos
    let prompt;
    if (isProductVideo && productImages.length > 0) {
      // For product videos with multiple images and vision analysis, create enhanced prompt
      const combinedAnalysis = productImages
        .map((img, index) => `Image ${index + 1}: ${img.visionAnalysis}`)
        .join("\n\n");

      const productAnalysisPrompt = `
        Create a compelling ${numScenes}-scene advertisement for ${productName} (${adType} ad) targeting ${targetAudience}.
        Total duration: ${totalDuration} seconds.
        
        PRODUCT ANALYSIS FROM AI VISION (${productImages.length} images):
        ${combinedAnalysis}
        
        USER REQUIREMENTS:
        ${keyPoints ? `Key points to highlight: ${keyPoints}` : "No specific key points provided"}
        Style: Professional product advertisement
        
        PROFESSIONAL QUALITY STANDARDS:
        All scene descriptions must include professional photography elements:
        - Ultra sharp, crystal clear product details
        - Perfect professional lighting with dramatic effects and even exposure
        - Dynamic angles and perspectives to showcase product features effectively
        - High contrast backgrounds that make the product stand out prominently
        - Vibrant, accurate colors that enhance the product's appeal
        - Commercial advertising quality composition and aesthetic
        - Professional studio lighting or dramatic environmental lighting
        - Clean, artifact-free backgrounds with enhanced visual interest
        - Cinematic depth of field and focus on product details
        
        IMPORTANT: Use the AI vision analysis from all ${productImages.length} product images to create scenes that:
        1. Highlight the specific features, colors, and characteristics identified across all images
        2. Show the product from different angles and perspectives as described in the analyses
        3. Emphasize the unique selling points mentioned in the combined analysis
        4. Create compelling product-focused scenarios that will work well with Flux Kontext using multiple reference images
        5. Utilize the variety of angles and details available from the ${productImages.length} reference images
        6. Incorporate professional product photography techniques like hero shots, detail close-ups, and lifestyle scenarios
        7. Use dynamic lighting setups that enhance product textures, materials, and key features
        8. Create visually striking compositions with strong background contrast
        
        Generate ${numScenes} scenes as a JSON array where each scene should feature the analyzed product prominently.
        Each scene object should have:
        - description: Detailed visual description incorporating insights from all vision analyses AND professional photography quality standards
        - text: Compelling text overlay 
        - duration: Scene duration in seconds (total must equal ${totalDuration}s)
        - useFluxKontext: true (mark all scenes to use Flux Kontext with multiple product references)
        
        Make sure all scenes prominently feature the product with professional advertising quality and would benefit from Flux Kontext integration with multiple reference images.
      `;
      prompt = productAnalysisPrompt;
    } else if (analysisPrompt) {
      // Use existing comprehensive analysis prompt
      prompt = GENERATE_STORYBOARD_PROMPT(
        analysisPrompt,
        numScenes,
        totalDuration
      );
    } else {
      // Fallback to original prompt logic
      prompt = FALLBACK_STORYBOARD_PROMPT(
        adType,
        productName,
        targetAudience,
        keyPoints,
        numScenes,
        totalDuration
      );
    }

    // For demo purposes, return mock data
    let mockScenes = [];

    // If OPENAI_API_KEY is available, use it to generate scenes
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(
          "Calling OpenAI API for scene generation with prompt:",
          prompt.trim().substring(0, 200) + "..."
        );

        // Call the OpenAI API
        const aiResponse = await openAIService.createCompletion({
          prompt: prompt,
          temperature: 0.7,
          max_tokens: 1000,
        });

        // Parse the response
        const responseContent = aiResponse.choices[0].text;
        // Ensure we're working with a string
        const sceneText =
          typeof responseContent === "string"
            ? responseContent.trim()
            : String(responseContent).trim();

        console.log("OpenAI response:", sceneText.substring(0, 100) + "...");

        try {
          // Try to parse the response as JSON
          let generatedScenes;

          try {
            // First, look for JSON array pattern with [] brackets
            // Using a more compatible regex without the 's' flag
            const jsonMatch = sceneText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
              generatedScenes = JSON.parse(jsonMatch[0]);
            } else {
              // Otherwise try to parse the whole response
              generatedScenes = JSON.parse(sceneText);
            }

            // Validate that we got an array of scenes
            if (Array.isArray(generatedScenes)) {
              console.log(
                `Successfully parsed ${generatedScenes.length} scenes from OpenAI`
              );

              // Return the AI-generated scenes
              return {
                adType,
                productName,
                targetAudience,
                keyPoints: keyPoints
                  ? keyPoints.split("\n").filter((k) => k.trim())
                  : [],
                scenes: generatedScenes,
              };
            } else {
              console.error(
                "OpenAI response was not an array:",
                typeof generatedScenes
              );
              throw new Error("Invalid response format from OpenAI");
            }
          } catch (parseError) {
            console.error("Error parsing OpenAI response as JSON:", parseError);
            throw new Error("Failed to parse AI-generated scenes");
          }
        } catch (processingError) {
          console.error("Error processing OpenAI response:", processingError);
          // Continue to use fallback mock scenes
        }
      } catch (openAIError) {
        console.error("Error calling OpenAI API:", openAIError);
        // Continue to use fallback mock scenes
      }
    }

    console.log("Using fallback scene generation (OpenAI not available)");

    // For now we'll use our placeholder implementation

    // Generate scenes based on ad type and key points
    if (adType === "product") {
      // Enhanced product scene generation with vision analysis
      const hasVisionAnalysis = isProductVideo && productImages.length > 0;

      // Process key points for more targeted generation
      const hasEasterTheme = keyPoints.toLowerCase().includes("easter");
      const hasColorTheme = keyPoints.toLowerCase().includes("color");
      const hasPromoTheme =
        keyPoints.toLowerCase().includes("promo") ||
        keyPoints.toLowerCase().includes("sale");

      console.log(
        `Key points analysis: Easter: ${hasEasterTheme}, Colors: ${hasColorTheme}, Promo: ${hasPromoTheme}`
      );

      if (hasVisionAnalysis) {
        console.log(
          `Using vision analysis from ${productImages.length} product images for enhanced scene generation`
        );
      } else {
        console.log(
          "Advanced AI analysis would provide more sophisticated scene descriptions"
        );
      }

      mockScenes = [
        {
          description: hasVisionAnalysis
            ? `Close-up beauty shot of ${productName} incorporating features from ${productImages.length} analyzed images: Professional lighting showcasing the product's key characteristics identified by AI vision across multiple angles and perspectives.`
            : hasEasterTheme
              ? `Close-up beauty shot of ${productName} with Easter themed decorations and ${hasColorTheme ? "vibrant, dynamic color splashes" : "festive spring colors"} in the background, highlighting the special promotion.`
              : `Close-up beauty shot of ${productName} on a minimal background, showing its premium design and key features.`,
          text: hasPromoTheme
            ? `Special ${hasEasterTheme ? "Easter" : ""} Sale! ${productName}`
            : `Introducing the revolutionary ${productName}`,
          duration: 3,
          useFluxKontext: hasVisionAnalysis, // Mark for Flux Kontext if vision analysis available
        },
        {
          description: hasVisionAnalysis
            ? `Person using ${productName} in a lifestyle setting, highlighting the specific features and style elements identified across ${productImages.length} AI-analyzed product images from different angles.`
            : `Person using ${productName} in a ${hasColorTheme ? "colorful, dynamic environment with shifting color gradients" : "stylish environment"}, demonstrating its main feature.`,
          text: hasPromoTheme
            ? `Limited Time ${hasEasterTheme ? "Easter" : ""} Offer`
            : `Experience unparalleled performance`,
          duration: 3,
          useFluxKontext: hasVisionAnalysis, // Mark for Flux Kontext if vision analysis available
        },
      ];

      if (numScenes >= 3) {
        mockScenes.push({
          description: hasVisionAnalysis
            ? `Split screen showing ${productName} in multiple scenarios, emphasizing the colors, materials, and design elements identified in the AI analysis. Each view showcases different aspects of the product's appeal.`
            : hasEasterTheme
              ? `Split screen showing ${productName} being used during Easter celebrations with ${hasColorTheme ? "colorful dynamic lighting effects and vibrant Easter decorations" : "festive Easter decorations"}.`
              : `Split screen showing ${productName} being used in multiple settings by different people.`,
          text: hasPromoTheme
            ? `Save Now on ${productName}!`
            : `Perfect for any lifestyle`,
          duration: 3,
          useFluxKontext: hasVisionAnalysis, // Mark for Flux Kontext if vision analysis available
        });
      }

      if (numScenes >= 4) {
        mockScenes.push({
          description: hasVisionAnalysis
            ? `Close-up detail shot of ${productName}'s most compelling feature as identified by AI vision analysis. Focus on the specific textures, finishes, and design elements that make this product unique and appealing.`
            : hasEasterTheme || hasColorTheme
              ? `Close-up of ${productName}'s unique selling point or innovative feature with ${hasColorTheme ? "dynamic color transitions and effects" : "stylish Easter-themed lighting"}.`
              : `Close-up of ${productName}'s unique selling point or innovative feature.`,
          text: hasPromoTheme
            ? `${hasEasterTheme ? "Easter" : "Special"} Discount - Limited Time!`
            : `Exclusive technology you won't find anywhere else`,
          duration: 2,
          useFluxKontext: hasVisionAnalysis, // Mark for Flux Kontext if vision analysis available
        });
      }

      if (numScenes >= 5) {
        mockScenes.push({
          description: hasVisionAnalysis
            ? `Final call-to-action shot of ${productName} with professional presentation matching the style and quality identified in the AI analysis. Include branding elements that complement the product's aesthetic appeal.`
            : hasPromoTheme
              ? `${productName} shown with special pricing, promotional badges, and ${hasEasterTheme ? "Easter-themed" : ""} ${hasColorTheme ? "colorful dynamic" : "animated"} call to action buttons.`
              : `Product logo and ${productName} shown with pricing and call to action.`,
          text: hasPromoTheme
            ? `${productName} - ${hasEasterTheme ? "Easter" : ""} Sale Ends Soon!`
            : `${productName} - Available now. Elevate your experience.`,
          duration: 2,
          useFluxKontext: hasVisionAnalysis, // Mark for Flux Kontext if vision analysis available
        });
      }
    } else if (adType === "brand") {
      mockScenes = [
        {
          description: `Cinematic establishing shot showcasing the ${productName} brand identity, logo prominently displayed with elegant lighting.`,
          text: `${productName}`,
          duration: 3,
        },
        {
          description: `Montage of people from diverse backgrounds using or interacting with ${productName} products, expressing joy and satisfaction.`,
          text: `Trusted by millions worldwide`,
          duration: 3,
        },
      ];

      if (numScenes >= 3) {
        mockScenes.push({
          description: `Historical timeline showing the evolution of ${productName} brand, morphing from past to present designs.`,
          text: `Innovation since [year]`,
          duration: 3,
        });
      }

      if (numScenes >= 4) {
        mockScenes.push({
          description: `Brand values visualization - abstract imagery representing what ${productName} stands for.`,
          text: `Quality. Trust. Innovation.`,
          duration: 2,
        });
      }

      if (numScenes >= 5) {
        mockScenes.push({
          description: `Inspirational closing shot with ${productName} logo, tagline, and social media handles.`,
          text: `${productName} - Part of your life`,
          duration: 2,
        });
      }
    } else if (adType === "promo") {
      mockScenes = [
        {
          description: `Dynamic text animation announcing special promotion for ${productName}, with attention-grabbing visual effects.`,
          text: `SPECIAL OFFER`,
          duration: 2,
        },
        {
          description: `${productName} shown with discount graphics and promotional pricing, highlighted with special effects.`,
          text: `Save 30% for a limited time only!`,
          duration: 3,
        },
      ];

      if (numScenes >= 3) {
        mockScenes.push({
          description: `Happy customers using ${productName}, with satisfied expressions.`,
          text: `Join thousands of satisfied customers`,
          duration: 3,
        });
      }

      if (numScenes >= 4) {
        mockScenes.push({
          description: `Countdown timer animation showing limited time remaining for promotion.`,
          text: `Hurry - Offer ends soon!`,
          duration: 2,
        });
      }

      if (numScenes >= 5) {
        mockScenes.push({
          description: `Call to action scene showing ${productName} with "Shop Now" button and website URL.`,
          text: `Visit our website or scan this QR code to redeem`,
          duration: 3,
        });
      }
    } else {
      // Generic scenes for other ad types
      mockScenes = Array(numScenes)
        .fill(0)
        .map((_, index) => ({
          description: `Scene ${index + 1} for ${productName} advertisement, showing the product in use.`,
          text:
            index === 0
              ? `Introducing ${productName}`
              : index === numScenes - 1
                ? `Get your ${productName} today`
                : `Feature highlight ${index}`,
          duration: 3,
        }));
    }

    // Limit to requested number of scenes
    mockScenes = mockScenes.slice(0, numScenes);

    // Now adjust the durations to match the total duration
    const currentTotalDuration = mockScenes.reduce(
      (sum, scene) => sum + scene.duration,
      0
    );

    // If current duration doesn't match requested duration, adjust scene durations
    if (currentTotalDuration !== totalDuration) {
      console.log(
        `Adjusting scene durations to match total duration of ${totalDuration}s (current: ${currentTotalDuration}s)`
      );

      // Calculate how much to adjust each scene by
      const durationDifference = totalDuration - currentTotalDuration;
      const avgAdjustment = durationDifference / numScenes;

      // Create a priority list for adjustment (shorter scenes get smaller adjustments)
      let remainingDifference = durationDifference;

      // First pass - try to adjust without going below 1s or above 5s
      mockScenes = mockScenes.map((scene) => {
        // Calculate ideal new duration
        let newDuration = Math.round(scene.duration + avgAdjustment);

        // Ensure it's within bounds
        newDuration = Math.max(1, Math.min(5, newDuration));

        // Track how much of the difference we've addressed
        const actualAdjustment = newDuration - scene.duration;
        remainingDifference -= actualAdjustment;

        return {
          ...scene,
          duration: newDuration,
        };
      });

      // Second pass if needed - distribute any remaining difference to scenes
      // that can still be adjusted
      if (remainingDifference !== 0) {
        // Sort scenes by their ability to absorb more duration change
        const sortedIndexes = mockScenes
          .map((scene, index) => ({
            index,
            capacity:
              remainingDifference > 0
                ? 5 - scene.duration // Room to increase
                : scene.duration - 1, // Room to decrease
          }))
          .sort((a, b) => b.capacity - a.capacity) // Sort by most capacity
          .map((item) => item.index);

        // Distribute the remaining difference
        for (const index of sortedIndexes) {
          if (remainingDifference === 0) break;

          const scene = mockScenes[index];

          if (remainingDifference > 0 && scene.duration < 5) {
            // Need to increase duration
            scene.duration += 1;
            remainingDifference -= 1;
          } else if (remainingDifference < 0 && scene.duration > 1) {
            // Need to decrease duration
            scene.duration -= 1;
            remainingDifference += 1;
          }
        }
      }

      // Final validation of total duration
      const finalDuration = mockScenes.reduce(
        (sum, scene) => sum + scene.duration,
        0
      );
      console.log(
        `Final adjusted duration: ${finalDuration}s (target: ${totalDuration}s)`
      );
    }

    // For a real implementation, this would be the actual OpenAI call
    // const response = await openAIService.createCompletion({
    //   model: "gpt-4",
    //   prompt,
    //   temperature: 0.7,
    //   max_tokens: 1000
    // });

    // const concept = JSON.parse(response.choices[0].text);

    return {
      adType,
      productName,
      targetAudience,
      keyPoints: keyPoints ? keyPoints.split("\n") : [],
      scenes: mockScenes,
    };
  } catch (error) {
    console.error("Error generating ad concept:", error);
    throw new Error("Failed to generate ad concept");
  }
}

/**
 * Generate scene images using Runware based on the ad concept
 */
async function generateScenesFromConcept(
  adConcept: any,
  format: string,
  style: string,
  userId: string = "dev-user-id",
  productImages: Array<{ url: string; visionAnalysis: string }> = [], // Product images for Flux Kontext
  isProductVideo: boolean = false // Flag for product video type
): Promise<any[]> {
  try {
    const scenes = [];

    // Process each scene in the concept
    for (const scene of adConcept.scenes) {
      // Enhance prompt with style
      let prompt = scene.description;
      if (style !== "realistic") {
        prompt = `${prompt} (in ${style} style)`;
      }

      // Check if this scene should use Flux Kontext
      const shouldUseFluxKontext =
        scene.useFluxKontext && productImages.length > 0 && isProductVideo;

      // Use appropriate image generation service
      let imageUrl = "";

      try {
        if (shouldUseFluxKontext) {
          console.log(
            `Generating image with Flux Kontext for scene with prompt: "${prompt}"`
          );
          console.log(`Using ${productImages.length} product reference images`);

          // Use existing Flux Kontext service for product-focused scenes
          try {
            const { fluxKontextService } = await import(
              "@/app/utils/flux-kontext"
            );

            // Use first image as main reference, second image as additional reference
            const mainReferenceImage = productImages[0].url;
            const additionalImages = productImages
              .slice(1)
              .map((img) => img.url);

            console.log(`Main reference: ${mainReferenceImage}`);
            console.log(`Additional images: ${additionalImages.length}`);

            const fluxResult = await fluxKontextService.editImage({
              referenceImageUrl: mainReferenceImage,
              additionalImages: additionalImages,
              editPrompt: prompt,
              format: format as "9:16" | "16:9" | "1:1" | "4:5",
              userId: userId,
            });

            if (fluxResult.imageURL) {
              imageUrl = fluxResult.imageURL;
              console.log(`Generated image with Flux Kontext: ${imageUrl}`);
            } else {
              console.log(
                "Flux Kontext did not return image URL, falling back to Runware"
              );
              throw new Error("No image URL from Flux Kontext");
            }
          } catch (fluxError) {
            console.error(
              "Error with Flux Kontext, falling back to Runware:",
              fluxError
            );
            // Continue to Runware fallback below
          }
        }

        // If not using Flux Kontext or Flux Kontext failed, use Runware
        if (!imageUrl) {
          console.log(
            `Generating image with Runware for scene with prompt: "${prompt}"`
          );

          // Convert format string to Runware format type
          const formatType = format as "9:16" | "16:9" | "1:1" | "4:5";

          // Use centralized dimensions to ensure consistency with video export
          const {
            getDimensionsFromFormat,
          } = require("@/app/utils/video-dimensions");
          const dimensions = getDimensionsFromFormat(formatType);
          const width = dimensions.width;
          const height = dimensions.height;

          // Call Runware service for image generation
          const result = await runwareService.generateImage({
            prompt,
            format: formatType,
            width,
            height,
            numSamples: 1,
            negativePrompt:
              "low quality, bad quality, blurry, distorted, deformed, text, watermark, signature, logo",
          });

          // Set the image URL from the result, ensuring it's a string
          if (result.imageURL) {
            console.log(`Generated image from Runware: ${result.imageURL}`);

            // Download and upload to S3
            try {
              const s3Url = await s3Utils.downloadAndUploadToS3(
                result.imageURL,
                userId,
                "image",
                `project_scene_${scenes.length + 1}_${format}_${Date.now()}.jpg`
              );

              imageUrl = s3Url;
              console.log(`Scene image uploaded to S3: ${s3Url}`);
            } catch (s3Error) {
              console.error(
                "Failed to upload scene image to S3, using original URL:",
                s3Error
              );
              imageUrl = result.imageURL; // Fallback to original URL
            }
          } else {
            // Fallback if imageURL is undefined
            console.log("No image URL returned from Runware, using fallback");
            imageUrl =
              "https://images.unsplash.com/photo-1511296265581-c2450046447d?q=80&w=1000&auto=format";
          }
        }
      } catch (error) {
        console.error("Error generating image with Runware:", error);

        // Fallback to mock images if Runware fails
        console.log("Falling back to mock image URLs");

        let mockImageUrl;
        if (style === "realistic") {
          mockImageUrl =
            "https://images.unsplash.com/photo-1511296265581-c2450046447d?q=80&w=1000&auto=format";
        } else if (style === "cinematic") {
          mockImageUrl =
            "https://images.unsplash.com/photo-1517697471339-4aa32003c11a?q=80&w=1000&auto=format";
        } else if (style === "3D rendered") {
          mockImageUrl =
            "https://images.unsplash.com/photo-1633613286991-611fe299c4be?q=80&w=1000&auto=format";
        } else if (style === "minimalist") {
          mockImageUrl =
            "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=1000&auto=format";
        } else {
          mockImageUrl =
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format";
        }

        // Add a random seed for variation
        const seed = Math.floor(Math.random() * 1000);
        imageUrl = `${mockImageUrl}&seed=${seed}`;
      }

      // Create complete scene object
      scenes.push({
        id: `scene-${Date.now()}-${scenes.length}`,
        order: scenes.length,
        duration: scene.duration || 3,
        imageUrl: imageUrl,
        prompt: scene.description,
        textOverlay: scene.text,
        elements: [],
        useFluxKontext: shouldUseFluxKontext, // Include Flux Kontext flag
        productImages: shouldUseFluxKontext ? productImages : undefined, // Include product references if used
      });
    }

    return scenes;
  } catch (error) {
    console.error("Error generating scenes from concept:", error);
    throw new Error("Failed to generate scene images");
  }
}
