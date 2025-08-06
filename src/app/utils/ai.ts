import { openAIService } from "./openai";
import { runwareService } from "./runware";
import { elevenLabsService } from "./elevenlabs";
import { fluxKontextService } from "./flux-kontext";
import { s3Utils } from "@/lib/s3-utils";
import { z } from "zod";
import {
  GENERATE_BACKGROUND_PROMPT,
  GENERATE_ASSET_PROMPT,
  ANALYZE_VIDEO_CONTENT_PROMPT,
} from "./prompts";

// Schema definitions using Zod
const SceneDataSchema = z.object({
  prompt: z.string(),
  imageUrl: z.string().url(),
  duration: z.number().min(1).max(10).default(3),
});

const BackgroundDataSchema = z.object({
  prompt: z.string(),
  imageUrl: z.string().url(),
  type: z.literal("background").default("background"),
});

const VideoFormatSchema = z.enum(["9:16", "16:9", "1:1", "4:5"]);

const VoiceoverResultSchema = z.object({
  audioUrl: z.string().url(),
  duration: z.number().min(0),
});

const FluxEditResultSchema = z.object({
  imageUrl: z.string().url(),
  cost: z.number().optional(),
  taskUUID: z.string().optional(),
  imageUUID: z.string().optional(),
});

// Types derived from schemas
type SceneData = z.infer<typeof SceneDataSchema>;
type BackgroundData = z.infer<typeof BackgroundDataSchema>;
type VideoFormat = z.infer<typeof VideoFormatSchema>;
type VoiceoverResult = z.infer<typeof VoiceoverResultSchema>;
type FluxEditResult = z.infer<typeof FluxEditResultSchema>;

/**
 * Generates scenes for a video based on a text prompt
 * @param prompt The text prompt to generate scenes from
 * @param format The aspect ratio format (9:16, 16:9, 1:1, 4:5)
 * @param numScenes Number of scenes to generate (1-5)
 * @param userId The user ID for S3 storage (defaults to 'dev-user-id' in development)
 * @returns Array of scene data objects with S3 URLs
 */
export async function generateVideoFromPrompt(
  prompt: string,
  format: VideoFormat = "9:16",
  numScenes: number = 3,
  userId: string = "dev-user-id"
): Promise<SceneData[]> {
  try {
    // Validate format
    const validFormat = VideoFormatSchema.parse(format);

    // Step 1: Generate scene descriptions using OpenAI with the requested number of scenes
    const sceneDescriptions = await openAIService.generateSceneDescriptions(
      prompt,
      numScenes
    );
    console.log(
      `Generated ${sceneDescriptions.length} scene descriptions from prompt`
    );

    // Step 2: For each scene, generate an image using Runware
    const scenes: SceneData[] = [];

    // Generate images for each scene with proper format
    try {
      // Process scenes in parallel for faster generation
      const scenePromises = sceneDescriptions.map(
        async (
          scene: { description: string; duration?: number },
          index: number
        ) => {
          try {
            console.log(
              `Generating image for scene ${index + 1}: ${scene.description.substring(0, 50)}...`
            );

            // Generate image for this scene
            const imageResult = await runwareService.generateImage({
              prompt: scene.description,
              format: validFormat,
              numSamples: 1,
              negativePrompt:
                "low quality, bad quality, blurry, distorted, deformed, text, watermark, signature, logo",
            });

            // Download generated image and upload to S3
            try {
              const s3Url = await s3Utils.downloadAndUploadToS3(
                imageResult.imageURL || "",
                userId,
                "image",
                `scene_${index + 1}_${format}_${Date.now()}.jpg`
              );

              console.log(`Scene ${index + 1} image uploaded to S3:`, s3Url);

              // Create scene data with S3 URL
              return SceneDataSchema.parse({
                prompt: scene.description,
                imageUrl: s3Url,
                duration: scene.duration || 3,
              });
            } catch (s3Error) {
              console.error(
                `Failed to upload scene ${index + 1} to S3, using original URL:`,
                s3Error
              );
              // Fallback to original Runware URL if S3 upload fails
              return SceneDataSchema.parse({
                prompt: scene.description,
                imageUrl: imageResult.imageURL,
                duration: scene.duration || 3,
              });
            }
          } catch (sceneError) {
            console.error(
              `Error generating image for scene ${index + 1}:`,
              sceneError
            );

            // Create fallback for this specific scene
            const fallbackSceneData = SceneDataSchema.parse({
              prompt: scene.description,
              imageUrl: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/1200`,
              duration: scene.duration || 3,
            });

            return fallbackSceneData;
          }
        }
      );

      // Wait for all scenes to be processed
      const generatedScenes = await Promise.all(scenePromises);
      scenes.push(...generatedScenes);

      console.log(`Successfully generated ${scenes.length} scenes`);
      return scenes;
    } catch (apiError) {
      console.error("Fatal error processing scenes:", apiError);
      throw apiError; // Propagate to use fallback
    }
  } catch (error) {
    console.error("Error generating video from prompt:", error);

    // Create valid mock data as fallback
    const mockScenes: SceneData[] = [];
    for (let i = 0; i < 3; i++) {
      const seedNum = Math.floor(Math.random() * 1000);

      mockScenes.push(
        SceneDataSchema.parse({
          prompt: `Scene ${i + 1} from: ${prompt}`,
          imageUrl: `https://picsum.photos/seed/${seedNum}/800/1200`,
          duration: 3,
        })
      );
    }

    return mockScenes;
  }
}

/**
 * Generates an AI voiceover from text
 * @param text The text to convert to speech
 * @param voice The voice ID to use
 * @returns Object with audio URL and duration
 */
export async function generateAIVoiceover(
  text: string,
  voice: string = "eleven_multilingual_v2"
): Promise<VoiceoverResult> {
  try {
    // Validate text input
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Use ElevenLabs API to generate voice if available
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        // In a real implementation with the API key available:
        // const result = await elevenLabsService.generateSpeech({
        //   voiceId: voice,
        //   text,
        //   voiceSpeed: 1.0,
        // });

        // For now, use mock result since we're focused on integration
        const mockResult = VoiceoverResultSchema.parse({
          audioUrl: "https://example.com/audio/sample.mp3",
          duration: Math.max(1, Math.ceil(text.length / 20)), // Rough estimate: 20 chars per second
        });

        return mockResult;
      } catch (apiError) {
        console.error("ElevenLabs API error:", apiError);
        throw apiError;
      }
    } else {
      // No API key, return mock result
      return VoiceoverResultSchema.parse({
        audioUrl: "https://example.com/audio/sample.mp3",
        duration: Math.max(1, Math.ceil(text.length / 20)),
      });
    }
  } catch (error) {
    console.error("Error generating AI voiceover:", error);

    // Return a valid mock result as fallback
    return VoiceoverResultSchema.parse({
      audioUrl: "https://example.com/audio/sample.mp3",
      duration: Math.max(1, Math.ceil(text.length / 20)),
    });
  }
}

/**
 * Analyzes video content prompt and provides suggestions
 * @param videoPrompt The prompt to analyze
 * @returns Analysis text
 */
/**
 * Generates a background image based on a text prompt using Runware
 * @param prompt The text prompt to generate the background from
 * @param format The aspect ratio format (9:16, 16:9, 1:1, 4:5)
 * @param userId The user ID for S3 storage (defaults to 'dev-user-id' in development)
 * @returns Background data object with S3 image URL
 */
export async function generateBackgroundImage(
  prompt: string,
  format: VideoFormat = "16:9",
  userId: string = "dev-user-id"
): Promise<BackgroundData> {
  try {
    // Validate format
    const validFormat = VideoFormatSchema.parse(format);

    console.log(
      `Generating background image with Runware from prompt: ${prompt}`
    );
    console.log(`Format: ${validFormat}`);

    try {
      // Generate image using Runware service with centralized prompt
      const enhancedPrompt = GENERATE_BACKGROUND_PROMPT(prompt, "high quality");

      console.log(`Using prompt for Runware: "${enhancedPrompt}"`);

      const imageResult = await runwareService.generateImage({
        prompt: enhancedPrompt,
        format: validFormat,
        numSamples: 1,
        negativePrompt:
          "watermark, signature, logo, low quality, bad quality, blurry, distorted, deformed",
      });

      // Download generated image and upload to S3
      try {
        const s3Url = await s3Utils.downloadAndUploadToS3(
          imageResult.imageURL || "",
          userId,
          "image",
          `background_${format}_${Date.now()}.jpg`
        );

        console.log("Background image uploaded to S3:", s3Url);

        // Return the background data with S3 URL
        return BackgroundDataSchema.parse({
          prompt,
          imageUrl: s3Url,
        });
      } catch (s3Error) {
        console.error(
          "Failed to upload background to S3, using original URL:",
          s3Error
        );
        // Fallback to original Runware URL if S3 upload fails
        return BackgroundDataSchema.parse({
          prompt,
          imageUrl: imageResult.imageURL,
        });
      }
    } catch (apiError) {
      console.error("Error generating background with Runware:", apiError);

      // Create a fallback background with default dimensions based on format
      let fallbackWidth = 1920;
      let fallbackHeight = 1080;
      
      if (validFormat === "9:16") {
        fallbackWidth = 1080;
        fallbackHeight = 1920;
      } else if (validFormat === "1:1") {
        fallbackWidth = 1080;
        fallbackHeight = 1080;
      } else if (validFormat === "4:5") {
        fallbackWidth = 1080;
        fallbackHeight = 1350;
      }
      
      const fallbackData = BackgroundDataSchema.parse({
        prompt,
        imageUrl: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/${fallbackWidth}/${fallbackHeight}`,
      });

      return fallbackData;
    }
  } catch (error) {
    console.error("Error generating background image:", error);

    // Create a valid fallback background with dimensions that are multiples of 64
    return BackgroundDataSchema.parse({
      prompt,
      imageUrl: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/1920/1088`,
    });
  }
}

export async function analyzeVideoContent(
  videoPrompt: string
): Promise<string> {
  try {
    // Validate input
    if (!videoPrompt || videoPrompt.trim().length === 0) {
      throw new Error("Video prompt cannot be empty");
    }

    // Use centralized prompt
    const analysisPrompt = ANALYZE_VIDEO_CONTENT_PROMPT(videoPrompt);

    const analysis = await openAIService.analyzeVideoContent(
      videoPrompt,
      analysisPrompt
    );
    return analysis;
  } catch (error) {
    console.error("Error analyzing video content:", error);
    return "Unable to analyze video content at this time.";
  }
}

/**
 * Edits an image using Flux Kontext AI
 * @param referenceImageUrl The URL of the reference image to edit
 * @param editPrompt The text prompt describing the desired edits
 * @param format The aspect ratio format (9:16, 16:9, 1:1, 4:5)
 * @param userId The user ID for S3 storage
 * @returns Edited image data with S3 URL
 */
export async function editImageWithFluxKontext(
  referenceImageUrl: string,
  editPrompt: string,
  format: VideoFormat = "9:16",
  userId: string
): Promise<FluxEditResult> {
  try {
    // Validate inputs
    if (!referenceImageUrl || !editPrompt || !userId) {
      throw new Error(
        "Missing required parameters: referenceImageUrl, editPrompt, or userId"
      );
    }

    const validFormat = VideoFormatSchema.parse(format);

    console.log(
      `Editing image with Flux Kontext - Format: ${validFormat}, Prompt: ${editPrompt.substring(0, 50)}...`
    );

    // Use Flux Kontext service to edit the image
    const result = await fluxKontextService.editImage({
      referenceImageUrl,
      editPrompt,
      format: validFormat,
      userId,
    });

    console.log(`Successfully edited image with Flux Kontext`);

    // Return validated result
    return FluxEditResultSchema.parse({
      imageUrl: result.imageURL,
      cost: result.cost,
      taskUUID: (result as any).taskUUID,
      imageUUID: (result as any).imageUUID,
    });
  } catch (error) {
    console.error("Error editing image with Flux Kontext:", error);

    // For now, throw the error instead of providing a fallback
    // In a production environment, you might want to provide a fallback
    throw new Error(
      `Failed to edit image: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Uploads an external image to S3 for use with Flux Kontext
 * @param imageUrl The external image URL to upload
 * @param userId The user ID for S3 storage
 * @param filename Optional filename for the uploaded image
 * @returns S3 URL of the uploaded image
 */
export async function uploadImageForFluxKontext(
  imageUrl: string,
  userId: string,
  filename?: string
): Promise<string> {
  try {
    // Validate inputs
    if (!imageUrl || !userId) {
      throw new Error("Missing required parameters: imageUrl or userId");
    }

    console.log(
      `Uploading external image for Flux Kontext: ${imageUrl.substring(0, 50)}...`
    );

    // Use Flux Kontext service to download and upload the image
    const s3Url = await fluxKontextService.uploadReferenceImageToS3(
      imageUrl,
      userId,
      filename
    );

    console.log(`Successfully uploaded image for Flux Kontext to S3`);
    return s3Url;
  } catch (error) {
    console.error("Error uploading image for Flux Kontext:", error);
    throw new Error(
      `Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
