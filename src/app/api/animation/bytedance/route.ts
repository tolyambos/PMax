import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/utils/auth-middleware";
import { bytedanceAnimationService } from "@/app/utils/bytedance-animation";

export async function POST(request: NextRequest) {
  try {
    // Check authentication using the mock auth middleware
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return authResult.error;
    }

    const userId = authResult.user.id;

    const body = await request.json();
    const {
      imageUrl,
      prompt,
      resolution = "720p",
      duration = "5",
      cameraFixed = false,
      seed,
      endImageUrl,
    } = body;

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: imageUrl and prompt" },
        { status: 400 }
      );
    }

    console.log("[bytedance/animation] Processing request:", {
      userId: userId,
      imageUrl: imageUrl.substring(0, 100) + "...",
      endImageUrl: endImageUrl ? endImageUrl.substring(0, 100) + "..." : undefined,
      prompt: prompt.substring(0, 100) + "...",
      resolution,
      duration,
      cameraFixed,
      seed,
    });

    // Generate presigned URL if this is an S3 URL
    let publicImageUrl = imageUrl;
    let publicEndImageUrl = endImageUrl;
    
    try {
      // Check if this is an S3 URL that needs a presigned URL
      const isS3Url = (url: string) =>
        url && (url.includes("wasabisys.com") ||
        url.includes("amazonaws.com") ||
        url.includes("s3."));

      if (isS3Url(imageUrl)) {
        console.log(
          "[bytedance/animation] 🔗 Generating presigned URL for S3 image"
        );

        // Import S3 utils
        const { s3Utils } = await import("@/lib/s3-utils");

        // Extract bucket and key from the URL
        const { bucket, bucketKey } =
          s3Utils.extractBucketAndKeyFromUrl(imageUrl);

        // Generate presigned URL for Bytedance to access
        publicImageUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);

        console.log(
          "[bytedance/animation] ✅ Generated presigned URL:",
          publicImageUrl.substring(0, 100) + "..."
        );
      }
      
      // Also generate presigned URL for end image if provided
      if (endImageUrl && isS3Url(endImageUrl)) {
        console.log(
          "[bytedance/animation] 🔗 Generating presigned URL for S3 end image"
        );

        const { s3Utils } = await import("@/lib/s3-utils");
        const { bucket, bucketKey } =
          s3Utils.extractBucketAndKeyFromUrl(endImageUrl);

        publicEndImageUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);

        console.log(
          "[bytedance/animation] ✅ Generated presigned URL for end image:",
          publicEndImageUrl.substring(0, 100) + "..."
        );
      }
    } catch (s3Error) {
      console.error(
        "[bytedance/animation] ❌ Failed to generate presigned URL:",
        s3Error
      );
      // Continue with original URL and let Bytedance try to access it
    }

    // Check service availability
    const serviceStatus = bytedanceAnimationService.getStatus();
    console.log("[bytedance/animation] Service status:", serviceStatus);

    const result = await bytedanceAnimationService.generateAnimation({
      imageUrl: publicImageUrl,
      prompt,
      resolution,
      duration,
      cameraFixed,
      seed,
      endImageUrl: publicEndImageUrl,
    });

    console.log("[bytedance/animation] Successfully generated animation:", {
      videoUrl: result.videoUrl.substring(0, 100) + "...",
      seed: result.seed,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[bytedance/animation] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to generate animation",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Bytedance Animation API",
      description:
        "POST to generate animations using Bytedance's Seedance model",
      requiredFields: ["imageUrl", "prompt"],
      optionalFields: ["resolution", "duration", "cameraFixed", "seed", "endImageUrl"],
      examples: {
        imageUrl: "https://example.com/image.jpg",
        prompt: "A little dog is running in the sunshine",
        resolution: "720p",
        duration: "5",
        cameraFixed: false,
        seed: 12345,
      },
    },
    { status: 200 }
  );
}
