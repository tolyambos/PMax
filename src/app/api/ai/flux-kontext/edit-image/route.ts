import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/utils/auth-middleware";
import { fluxKontextService } from "@/app/utils/flux-kontext";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return authResult.error;
    }
    const userId = authResult.user.id;

    const body = await request.json();
    const {
      referenceImageUrl,
      additionalImages = [],
      editPrompt,
      format = "9:16",
    } = body;

    if (!referenceImageUrl || !editPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: referenceImageUrl and editPrompt" },
        { status: 400 }
      );
    }

    console.log("[flux-kontext/edit-image] Processing request:", {
      userId: userId,
      referenceImageUrl: referenceImageUrl.substring(0, 100) + "...",
      additionalImagesCount: additionalImages.length,
      editPrompt: editPrompt.substring(0, 100) + "...",
      format,
    });

    const result = await fluxKontextService.editImage({
      referenceImageUrl,
      additionalImages,
      editPrompt,
      format,
      userId: userId,
      maxRetries: 2,
      enableQualityAnalysis: true,
    });

    console.log("[flux-kontext/edit-image] Successfully edited image:", {
      imageURL: result.imageURL.substring(0, 100) + "...",
      cost: result.cost,
    });

    // Log quality analysis results if available
    if (result.qualityInfo) {
      console.log("[flux-kontext/edit-image] 📊 QUALITY ANALYSIS SUMMARY:");
      console.log(
        "[flux-kontext/edit-image] Total attempts:",
        result.qualityInfo.attempts.length
      );
      console.log(
        "[flux-kontext/edit-image] Final quality score:",
        result.qualityInfo.finalQualityScore,
        "/10"
      );
      console.log(
        "[flux-kontext/edit-image] Was retried due to quality:",
        result.qualityInfo.wasRetried
      );
      console.log(
        "[flux-kontext/edit-image] Quality details:",
        JSON.stringify(result.qualityInfo, null, 2)
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[flux-kontext/edit-image] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to edit image",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Flux Kontext Image Edit API",
      description: "POST to edit images using Flux Kontext",
      requiredFields: ["referenceImageUrl", "editPrompt"],
      optionalFields: ["format", "additionalImages"],
      examples: {
        referenceImageUrl: "https://example.com/image.jpg",
        additionalImages: [
          "https://example.com/ref1.jpg",
          "https://example.com/ref2.jpg",
        ],
        editPrompt: "Make the sky more dramatic",
        format: "9:16",
      },
    },
    { status: 200 }
  );
}
