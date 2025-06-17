/* eslint-disable max-lines */
import { z } from "zod";
import { RunwareServer } from "@runware/sdk-js";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { s3Utils } from "@/lib/s3-utils";

// Exact interface matching working Runware request format
interface IRequestImageInference {
  taskType: "imageInference";
  model: "bfl:4@1" | string;
  positivePrompt: string;
  width: number;
  height: number;
  outputFormat: "JPG" | "PNG";
  outputType: string[]; // Array format: ["URL"]
  includeCost: boolean;
  referenceImages: string[]; // Array format as shown in working example
  numberResults: number;
  seed?: number; // Optional seed parameter
  taskUUID?: string; // Optional task UUID
}

const FluxKontextEditOptionsSchema = z.object({
  referenceImageUrl: z.string().url(),
  additionalImages: z.array(z.string().url()).optional().default([]),
  editPrompt: z.string().min(1).max(1950),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().default("9:16"),
  userId: z.string(),
});

type FluxKontextEditOptions = z.infer<typeof FluxKontextEditOptionsSchema>;

interface FluxEditResult {
  imageURL: string;
  cost?: number;
  imageUUID?: string;
}

export class FluxKontextService {
  private runwareServer: RunwareServer | null = null;
  private mockMode: boolean;

  constructor() {
    const apiKey = process.env.RUNWARE_API_KEY!;
    this.mockMode = process.env.NODE_ENV === "development" && !apiKey;

    if (!this.mockMode) {
      this.runwareServer = new RunwareServer({ apiKey });
    }
  }

  /**
   * Get the closest supported Flux model dimensions based on aspect ratio
   */
  private getFluxSupportedDimensions(
    preferredWidth: number,
    preferredHeight: number
  ): { width: number; height: number } {
    // Supported dimensions for bfl:4@1 model
    const supportedDimensions = [
      { width: 1568, height: 672 }, // Ultra wide (2.33:1)
      { width: 1392, height: 752 }, // Wide (1.85:1)
      { width: 1248, height: 832 }, // Wide (1.5:1)
      { width: 1184, height: 880 }, // Slightly wide (1.35:1)
      { width: 1024, height: 1024 }, // Square (1:1)
      { width: 880, height: 1184 }, // Slightly tall (0.74:1)
      { width: 832, height: 1248 }, // Tall (0.67:1)
      { width: 752, height: 1392 }, // Tall (0.54:1)
      { width: 672, height: 1568 }, // Ultra tall (0.43:1)
    ];

    // Calculate the aspect ratio of the preferred dimensions
    const preferredAspectRatio = preferredWidth / preferredHeight;

    // Find the closest aspect ratio
    let closestDimensions = supportedDimensions[0];
    let minDifference = Math.abs(
      closestDimensions.width / closestDimensions.height - preferredAspectRatio
    );

    for (const dims of supportedDimensions) {
      const aspectRatio = dims.width / dims.height;
      const difference = Math.abs(aspectRatio - preferredAspectRatio);

      if (difference < minDifference) {
        minDifference = difference;
        closestDimensions = dims;
      }
    }

    return closestDimensions;
  }

  // Add this helper method to upload reference images
  private async uploadReferenceImage(
    base64Image: string,
    userId: string
  ): Promise<string> {
    try {
      // If it's already a URL, return it
      if (base64Image.startsWith("http")) {
        return base64Image;
      }

      console.log("[uploadReferenceImage] Uploading base64 image to S3");

      // Extract base64 data
      let base64Data: string;
      if (base64Image.startsWith("data:")) {
        base64Data = base64Image.split(",")[1];
      } else {
        base64Data = base64Image;
      }

      const buffer = Buffer.from(base64Data, "base64");

      // Generate unique key
      const timestamp = Date.now();
      const uniqueId = uuidv4();
      const bucketKey = `${userId}/reference_${uniqueId}_${timestamp}.jpg`;

      console.log(
        "[uploadReferenceImage] Uploading to S3 with key:",
        bucketKey
      );

      // Upload to S3
      await s3Utils.uploadBufferToS3(
        s3Utils.buckets.images,
        bucketKey,
        buffer,
        "image/jpeg"
      );

      // Get presigned URL
      const presignedUrl = await s3Utils.getPresignedUrl(
        s3Utils.buckets.images,
        bucketKey
      );

      console.log(
        "[uploadReferenceImage] Successfully uploaded reference image, URL:",
        presignedUrl
      );
      return presignedUrl;
    } catch (error) {
      console.error(
        "[uploadReferenceImage] Failed to upload reference image:",
        error
      );
      throw new Error("Failed to upload reference image");
    }
  }

  private async downloadImage(
    url: string,
    filePath: string,
    options?: { retryCount?: number; retryDelay?: number }
  ) {
    if (!url) {
      throw new Error("No URL provided for image download");
    }

    console.log(`Starting download of image from URL: ${url}`);
    console.log(`Will save to temporary path: ${filePath}`);

    // Ensure directory exists
    const directory = path.dirname(filePath);
    await fs.promises.mkdir(directory, { recursive: true });

    const retryCount = options?.retryCount ?? 3;
    const retryDelay = options?.retryDelay ?? 60000;
    let lastError: Error | null = null;

    // Try multiple times with delay between attempts
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `Retry attempt ${attempt + 1}/${retryCount} for downloading image: ${url}`
          );
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.promises.writeFile(filePath, buffer);

        // If successful, return early
        if (attempt > 0) {
          console.log(
            `Successfully downloaded image on retry attempt ${attempt + 1}: ${url}`
          );
        }
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Download attempt ${attempt + 1} failed for image: ${url}`,
          error
        );

        // If we have more retries left, wait before trying again
        if (attempt < retryCount - 1) {
          console.log(
            `Waiting ${retryDelay / 1000} seconds before next retry...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If we get here, all attempts failed
    console.error(
      `All ${retryCount} download attempts failed for image: ${url}`
    );
    throw new Error(
      lastError?.message || "Failed to download image after multiple attempts"
    );
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Analyze image quality using OpenAI Vision API directly
   */
  private async analyzeImageQuality(imageUrl: string): Promise<{
    isGoodQuality: boolean;
    qualityScore: number;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      console.log(
        "[analyzeImageQuality] Starting analysis for:",
        imageUrl.substring(0, 100) + "..."
      );

      // Call OpenAI Vision API directly since we're on server-side
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.warn(
          "[analyzeImageQuality] No OpenAI API key found, skipping quality analysis"
        );
        return {
          isGoodQuality: true,
          qualityScore: 7,
          issues: [],
          suggestions: [],
        };
      }

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze this image for quality issues and provide a detailed assessment. Rate the image quality on a scale of 1-10 and identify any problems:

Quality criteria to evaluate:
- Visual clarity and sharpness
- Proper lighting and exposure
- Realistic proportions and anatomy
- Coherent composition
- Absence of visual artifacts, distortions, or glitches
- Color accuracy and saturation
- Overall aesthetic appeal
- Consistency of style
- Absence of text errors or garbled elements
- Professional appearance suitable for advertising

Please respond in this exact JSON format:
{
  "qualityScore": <number 1-10>,
  "isGoodQuality": <boolean>,
  "issues": ["list", "of", "specific", "problems", "found"],
  "suggestions": ["list", "of", "specific", "improvements", "for", "better", "results"]
}

Focus on technical and aesthetic quality. A score of 7+ should be considered good quality.`,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageUrl,
                    },
                  },
                ],
              },
            ],
            max_tokens: 500,
          }),
        }
      );

      if (!response.ok) {
        console.warn(
          "[analyzeImageQuality] OpenAI API request failed:",
          response.status
        );
        // Fallback: assume good quality if analysis fails
        return {
          isGoodQuality: true,
          qualityScore: 7,
          issues: [],
          suggestions: [],
        };
      }

      const result = await response.json();
      console.log("[analyzeImageQuality] Raw OpenAI response:", result);

      // Try to parse the structured response from OpenAI
      let analysis;
      try {
        // OpenAI response is in result.choices[0].message.content
        const responseText = result.choices?.[0]?.message?.content || "";
        console.log(
          "[analyzeImageQuality] Parsing response text:",
          responseText
        );

        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
          console.log("[analyzeImageQuality] Parsed JSON analysis:", analysis);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        console.warn(
          "[analyzeImageQuality] Failed to parse structured response:",
          parseError
        );

        // Fallback: analyze the text for quality indicators
        const responseText = (
          result.choices?.[0]?.message?.content || ""
        ).toLowerCase();
        const qualityIssues = [
          "blurry",
          "distorted",
          "artifacts",
          "low quality",
          "poor lighting",
          "unrealistic",
          "garbled",
          "malformed",
          "inconsistent",
          "pixelated",
          "overexposed",
          "underexposed",
          "wrong proportions",
          "unnatural",
        ];

        const foundIssues = qualityIssues.filter((issue) =>
          responseText.includes(issue)
        );
        const qualityScore = Math.max(3, 8 - foundIssues.length); // Start at 8, subtract for each issue

        analysis = {
          qualityScore: qualityScore,
          isGoodQuality: qualityScore >= 7,
          issues: foundIssues,
          suggestions:
            foundIssues.length > 0
              ? [
                  "Improve lighting conditions",
                  "Enhance image clarity and sharpness",
                  "Adjust composition for better visual appeal",
                ]
              : [],
        };

        console.log(
          "[analyzeImageQuality] Fallback analysis created:",
          analysis
        );
      }

      // Ensure we have all required fields with proper types
      const finalAnalysis = {
        qualityScore: Math.max(1, Math.min(10, analysis.qualityScore || 5)),
        isGoodQuality: analysis.isGoodQuality ?? analysis.qualityScore >= 7,
        issues: Array.isArray(analysis.issues) ? analysis.issues : [],
        suggestions: Array.isArray(analysis.suggestions)
          ? analysis.suggestions
          : [],
      };

      console.log(
        "[analyzeImageQuality] Final analysis result:",
        finalAnalysis
      );
      return finalAnalysis;
    } catch (error) {
      console.error(
        "[analyzeImageQuality] Error analyzing image quality:",
        error
      );
      // Fallback: assume good quality on error
      return {
        isGoodQuality: true,
        qualityScore: 7,
        issues: ["Quality analysis failed"],
        suggestions: ["Manual review recommended"],
      };
    }
  }

  /**
   * Generate a single image with Runware
   */
  private async generateSingleImage(
    prompt: string,
    referenceImages: string[],
    width: number,
    height: number
  ): Promise<{ imageURL: string; cost: number }> {
    const requestParams = {
      taskType: "imageInference" as const,
      model: "bfl:4@1",
      positivePrompt: prompt,
      height: height,
      width: width,
      numberResults: 1,
      outputType: ["URL"],
      outputFormat: "JPG" as const,
      seed: Math.floor(Math.random() * 1000000000000000),
      includeCost: true,
      referenceImages: referenceImages,
    };

    console.log("[generateSingleImage] 📡 Calling Runware SDK...");

    if (!this.runwareServer) {
      throw new Error("Runware SDK not initialized");
    }

    const images = await this.runwareServer.requestImages(requestParams as any);

    if (!images || images.length === 0) {
      throw new Error("No image returned from Runware");
    }

    const imageData = images[0];
    const imageUrl = imageData.imageURL;

    if (!imageUrl) {
      throw new Error("No image URL in Runware response");
    }

    console.log(
      "[generateSingleImage] ✅ Received image:",
      imageUrl.substring(0, 100) + "..."
    );
    return {
      imageURL: imageUrl,
      cost: imageData.cost || 0,
    };
  }

  /**
   * Download image and upload to S3
   */
  private async downloadAndUploadToS3(
    imageUrl: string,
    userId: string
  ): Promise<string> {
    const timestamp = Date.now();
    const uniqueId = this.generateId();
    const bucketKey = `${userId}/edited_${timestamp}_${uniqueId}.jpg`;
    const tempPath = path.join(
      os.tmpdir(),
      `edited_${timestamp}_${uniqueId}.jpg`
    );

    console.log("[downloadAndUploadToS3] 📥 Downloading image...");
    await this.downloadImage(imageUrl, tempPath, {
      retryCount: 3,
      retryDelay: 2000,
    });

    const fileStats = await fs.promises.stat(tempPath);
    if (fileStats.size === 0) {
      throw new Error("Downloaded image file is empty");
    }

    console.log("[downloadAndUploadToS3] 📤 Uploading to S3...");
    await s3Utils.uploadToS3(s3Utils.buckets.images, bucketKey, tempPath);

    const presignedUrl = await s3Utils.getPresignedUrl(
      s3Utils.buckets.images,
      bucketKey
    );

    // Clean up temp file
    try {
      await fs.promises.unlink(tempPath);
    } catch (cleanupError) {
      console.warn(
        "[downloadAndUploadToS3] Failed to clean up temp file:",
        cleanupError
      );
    }

    console.log("[downloadAndUploadToS3] ✅ Successfully uploaded to S3");
    return presignedUrl;
  }

  /**
   * Improve prompt based on quality issues and suggestions
   */
  private improvePrompt(
    originalPrompt: string,
    qualityIssues: string[],
    suggestions: string[]
  ): string {
    console.log("[improvePrompt] Original prompt:", originalPrompt);
    console.log("[improvePrompt] Quality issues:", qualityIssues);
    console.log("[improvePrompt] Suggestions:", suggestions);

    let improvedPrompt = originalPrompt;

    // Add quality enhancement keywords based on common issues and AI suggestions
    const qualityEnhancements = [];

    if (
      qualityIssues.some(
        (issue) => issue.includes("blur") || issue.includes("sharp")
      )
    ) {
      qualityEnhancements.push(
        "ultra sharp",
        "crystal clear",
        "high definition",
        "precise focus"
      );
    }

    if (
      qualityIssues.some(
        (issue) => issue.includes("light") || issue.includes("expos")
      )
    ) {
      qualityEnhancements.push(
        "perfect professional lighting",
        "dramatic lighting effects",
        "even exposure",
        "studio lighting"
      );
    }

    if (
      qualityIssues.some(
        (issue) => issue.includes("distort") || issue.includes("artifact")
      )
    ) {
      qualityEnhancements.push(
        "clean composition",
        "no artifacts",
        "pristine quality",
        "flawless rendering"
      );
    }

    if (
      qualityIssues.some(
        (issue) => issue.includes("proportion") || issue.includes("anatomy")
      )
    ) {
      qualityEnhancements.push(
        "correct proportions",
        "anatomically accurate",
        "realistic scale",
        "proper geometry"
      );
    }

    if (
      qualityIssues.some(
        (issue) => issue.includes("color") || issue.includes("saturation")
      )
    ) {
      qualityEnhancements.push(
        "vibrant colors",
        "accurate color reproduction",
        "enhanced saturation",
        "color graded"
      );
    }

    // Add enhancements based on AI suggestions patterns
    if (
      suggestions.some(
        (s) =>
          s.toLowerCase().includes("angle") ||
          s.toLowerCase().includes("dynamic")
      )
    ) {
      qualityEnhancements.push(
        "dynamic camera angle",
        "compelling perspective",
        "cinematic composition"
      );
    }

    if (
      suggestions.some(
        (s) =>
          s.toLowerCase().includes("contrast") ||
          s.toLowerCase().includes("background")
      )
    ) {
      qualityEnhancements.push(
        "high contrast background",
        "enhanced visual separation",
        "dramatic backdrop"
      );
    }

    if (
      suggestions.some(
        (s) =>
          s.toLowerCase().includes("lighting") ||
          s.toLowerCase().includes("illuminat")
      )
    ) {
      qualityEnhancements.push(
        "professional studio lighting",
        "dramatic illumination",
        "perfect light balance"
      );
    }

    // Always add comprehensive quality improvements
    qualityEnhancements.push(
      "professional photography standard",
      "commercial advertising quality",
      "high-end production value",
      "cinematographic excellence",
      "ultra-high definition",
      "professional color grading",
      "award-winning composition"
    );

    // Construct the improved prompt with better structure
    const qualityString = qualityEnhancements.join(", ");
    improvedPrompt = `${originalPrompt}, featuring ${qualityString}`;

    // Add specific negative prompt elements to avoid common issues
    const negativeElements = [
      "blurry",
      "out of focus",
      "low quality",
      "artifacts",
      "distorted",
      "unrealistic",
      "poor lighting",
      "overexposed",
      "underexposed",
      "pixelated",
      "grainy",
      "noisy",
      "malformed",
      "incorrect proportions",
      "low resolution",
      "amateur",
      "unprofessional",
      "flat lighting",
    ];

    console.log("[improvePrompt] Enhanced prompt:", improvedPrompt);
    console.log("[improvePrompt] Would avoid:", negativeElements);

    return improvedPrompt;
  }

  private createMockEditResponse(
    width: number,
    height: number
  ): FluxEditResult {
    const imageId = Math.floor(Math.random() * 1000);
    return {
      imageURL: `https://picsum.photos/seed/edited_${imageId}/${width}/${height}`,
      cost: 0.0,
      imageUUID: `flux-kontext-${this.generateId()}`,
    };
  }

  async editImage(args: {
    referenceImageUrl: string;
    additionalImages?: string[];
    editPrompt: string;
    format: "9:16" | "16:9" | "1:1" | "4:5";
    userId: string;
    maxRetries?: number;
    enableQualityAnalysis?: boolean;
  }): Promise<{ imageURL: string; cost?: number; qualityInfo?: any }> {
    const {
      referenceImageUrl,
      additionalImages = [],
      editPrompt,
      format,
      userId,
      maxRetries = 2,
      enableQualityAnalysis = true,
    } = args;

    // Initialize retry variables
    let currentPrompt = editPrompt;
    let totalCost = 0;
    let lastResult = null;
    let qualityInfo = {
      attempts: [] as Array<{
        attempt: number;
        prompt: string;
        qualityScore: number;
        issues: string[];
        suggestions: string[];
        cost: number;
        imageUrl?: string;
        error?: string;
      }>,
      finalQualityScore: 0,
      wasRetried: false,
    };

    console.log("[editImage] 🎯 STARTING FLUX KONTEXT WITH QUALITY ANALYSIS");
    console.log(
      "[editImage] ================================================================"
    );
    console.log(
      "[editImage] Reference URL:",
      referenceImageUrl.substring(0, 100) + "..."
    );
    console.log("[editImage] Original prompt:", editPrompt);
    console.log("[editImage] Max retries:", maxRetries);
    console.log("[editImage] Quality analysis enabled:", enableQualityAnalysis);
    console.log(
      "[editImage] ================================================================"
    );

    try {
      // Use supported dimensions for the Flux models
      const { width, height } = this.getFluxSupportedDimensions(
        format === "16:9" ? 1792 : 1024,
        format === "16:9" ? 1024 : 1792
      );

      if (this.mockMode) {
        console.log(
          "Using mock data for Flux Kontext (no API key or dev mode)"
        );
        return {
          ...this.createMockEditResponse(width, height),
          qualityInfo: {
            attempts: [{ attempt: 1, qualityScore: 8, prompt: editPrompt }],
            finalQualityScore: 8,
            wasRetried: false,
          },
        };
      }

      // Process reference images (simplified)
      console.log("[editImage] Processing reference images...");
      const allReferenceImages: string[] = [];

      // Process main reference image
      let referenceImageForRunware: string = referenceImageUrl;
      if (
        referenceImageUrl.includes("wasabisys.com") ||
        referenceImageUrl.includes("amazonaws.com")
      ) {
        try {
          const { bucket, bucketKey } =
            s3Utils.extractBucketAndKeyFromUrl(referenceImageUrl);
          referenceImageForRunware = await s3Utils.getPresignedUrl(
            bucket,
            bucketKey
          );
          console.log(
            "[editImage] ✅ Generated fresh presigned URL for main image"
          );
        } catch (error) {
          console.error(
            "[editImage] ❌ Failed to generate presigned URL:",
            error
          );
          throw new Error(
            "Failed to generate presigned URL for reference image"
          );
        }
      } else if (referenceImageUrl.startsWith("data:")) {
        referenceImageForRunware = await this.uploadReferenceImage(
          referenceImageUrl,
          userId
        );
        console.log("[editImage] ✅ Uploaded base64 to S3");
      }
      allReferenceImages.push(referenceImageForRunware);

      // Process additional images (simplified)
      for (let i = 0; i < additionalImages.length; i++) {
        const additionalImage = additionalImages[i];
        let processedAdditionalImage = additionalImage;

        if (
          additionalImage.includes("wasabisys.com") ||
          additionalImage.includes("amazonaws.com")
        ) {
          try {
            const { bucket, bucketKey } =
              s3Utils.extractBucketAndKeyFromUrl(additionalImage);
            processedAdditionalImage = await s3Utils.getPresignedUrl(
              bucket,
              bucketKey
            );
          } catch (error) {
            console.error(
              `[editImage] Failed to process additional image ${i + 1}:`,
              error
            );
          }
        } else if (additionalImage.startsWith("data:")) {
          try {
            processedAdditionalImage = await this.uploadReferenceImage(
              additionalImage,
              userId
            );
          } catch (error) {
            console.error(
              `[editImage] Failed to upload additional image ${i + 1}:`,
              error
            );
            continue;
          }
        }
        allReferenceImages.push(processedAdditionalImage);
      }

      console.log(
        `[editImage] ✅ Processed ${allReferenceImages.length} reference images`
      );

      // RETRY LOOP WITH QUALITY ANALYSIS
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        console.log("[editImage] 🔄 ATTEMPT", attempt, "OF", maxRetries + 1);
        console.log("[editImage] Current prompt:", currentPrompt);

        try {
          // Generate image
          const imageResult = await this.generateSingleImage(
            currentPrompt,
            allReferenceImages,
            width,
            height
          );
          console.log(
            "[editImage] 💰 Cost for this attempt:",
            imageResult.cost
          );
          totalCost += imageResult.cost;

          // Download and upload to S3
          const presignedUrl = await this.downloadAndUploadToS3(
            imageResult.imageURL,
            userId
          );

          // QUALITY ANALYSIS
          let qualityResult = null;
          if (enableQualityAnalysis) {
            console.log("[editImage] 🔍 ANALYZING IMAGE QUALITY...");
            qualityResult = await this.analyzeImageQuality(presignedUrl);

            console.log("[editImage] 📊 QUALITY ANALYSIS RESULT:");
            console.log(
              "[editImage] Quality Score:",
              qualityResult.qualityScore,
              "/10"
            );
            console.log(
              "[editImage] Is Good Quality:",
              qualityResult.isGoodQuality
            );
            console.log("[editImage] Issues Found:", qualityResult.issues);
            console.log("[editImage] Suggestions:", qualityResult.suggestions);
          }

          // Record this attempt
          qualityInfo.attempts.push({
            attempt: attempt,
            prompt: currentPrompt,
            qualityScore: qualityResult?.qualityScore || 0,
            issues: qualityResult?.issues || [],
            suggestions: qualityResult?.suggestions || [],
            cost: imageResult.cost,
            imageUrl: presignedUrl,
          });

          // Store current result
          lastResult = {
            imageURL: presignedUrl,
            cost: totalCost,
            qualityInfo: qualityInfo,
          };

          // Check if we should retry based on quality
          if (
            enableQualityAnalysis &&
            qualityResult &&
            !qualityResult.isGoodQuality &&
            attempt <= maxRetries
          ) {
            console.log(
              "[editImage] ❌ POOR QUALITY DETECTED (Score:",
              qualityResult.qualityScore,
              "/10)"
            );
            console.log("[editImage] 🔄 Will retry with improved prompt...");

            // Improve the prompt based on quality issues
            currentPrompt = this.improvePrompt(
              editPrompt,
              qualityResult.issues,
              qualityResult.suggestions
            );
            qualityInfo.wasRetried = true;

            console.log(
              "[editImage] 🚀 RETRYING WITH IMPROVED PROMPT:",
              currentPrompt
            );
            continue;
          } else {
            console.log(
              "[editImage] ✅ QUALITY ACCEPTABLE OR MAX RETRIES REACHED"
            );
            qualityInfo.finalQualityScore = qualityResult?.qualityScore || 0;
            break;
          }
        } catch (attemptError) {
          console.error(
            `[editImage] ❌ Attempt ${attempt} failed:`,
            attemptError
          );

          // Record failed attempt
          qualityInfo.attempts.push({
            attempt: attempt,
            prompt: currentPrompt,
            qualityScore: 0,
            issues: ["Generation failed"],
            suggestions: [],
            cost: 0,
            error:
              attemptError instanceof Error
                ? attemptError.message
                : "Unknown error",
          });

          // If this is the last attempt, throw the error
          if (attempt === maxRetries + 1) {
            throw attemptError;
          }

          console.log(`[editImage] 🔄 Will retry attempt ${attempt + 1}...`);
        }
      }

      console.log("[editImage] 🎉 FLUX KONTEXT COMPLETED");
      console.log(
        "[editImage] ================================================================"
      );
      console.log("[editImage] Total attempts:", qualityInfo.attempts.length);
      console.log("[editImage] Total cost:", totalCost);
      console.log(
        "[editImage] Final quality score:",
        qualityInfo.finalQualityScore
      );
      console.log(
        "[editImage] Was retried due to quality:",
        qualityInfo.wasRetried
      );
      console.log(
        "[editImage] ================================================================"
      );

      return (
        lastResult || {
          imageURL: "",
          cost: totalCost,
          qualityInfo: qualityInfo,
        }
      );
    } catch (error) {
      console.error("[editImage] Error editing image:", error);

      // Log more details about the error
      if (error && typeof error === "object" && "message" in error) {
        console.error("[editImage] Error message:", error.message);
      }
      if (error && typeof error === "object" && "response" in error) {
        console.error("[editImage] Error response:", error.response);
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check for Runware-specific errors
      if (error && typeof error === "object" && "error" in error) {
        const runwareError = (error as any).error;
        if (runwareError.code === "unsupportedArchitectureNegativePrompt") {
          // This shouldn't happen now, but just in case
          throw new Error("This model doesn't support negative prompts.");
        }
      }

      if (
        errorMessage.includes("WebSocket") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("ECONNREFUSED")
      ) {
        throw new Error(
          "Connection error with image editing service. Please try again."
        );
      }

      if (errorMessage.includes("unsupportedFluxKontextDimensions")) {
        throw new Error(
          "Invalid image dimensions for editing. Please try again."
        );
      }

      if (errorMessage.includes("referenceImages")) {
        throw new Error(
          "Failed to process reference image. Please ensure the image URL is accessible."
        );
      }

      throw new Error(`Failed to edit image: ${errorMessage}`);
    }
  }

  async uploadReferenceImageToS3(
    externalUrl: string,
    userId: string,
    filename?: string
  ): Promise<string> {
    console.log("[uploadReferenceImageToS3] Starting:", {
      externalUrl,
      userId,
      filename,
    });

    try {
      const response = await fetch(externalUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const finalFilename =
        filename ||
        `flux_upload_${Date.now()}.${this.getExtensionFromUrl(externalUrl) || "jpg"}`;

      const timestamp = Date.now();
      const uniqueId = uuidv4();
      const bucketKey = `${userId}/flux_upload_${timestamp}_${uniqueId}_${finalFilename}`;

      await s3Utils.uploadBufferToS3(
        s3Utils.buckets.images,
        bucketKey,
        buffer,
        "image/jpeg"
      );

      const presignedUrl = await s3Utils.getPresignedUrl(
        s3Utils.buckets.images,
        bucketKey
      );

      console.log("[uploadReferenceImageToS3] Successfully uploaded to S3");
      return presignedUrl;
    } catch (error) {
      console.error("[uploadReferenceImageToS3] Error:", error);
      throw new Error(
        `Failed to download and upload image: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private getExtensionFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split(".");
      return parts.length > 1 ? parts[parts.length - 1] : null;
    } catch {
      return null;
    }
  }
}

export const fluxKontextService = new FluxKontextService();
