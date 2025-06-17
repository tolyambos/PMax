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
    const { imageUrl, filename } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing required field: imageUrl" },
        { status: 400 }
      );
    }

    console.log("[flux-kontext/upload-reference] Processing request:", {
      userId: userId,
      imageUrl: imageUrl.substring(0, 100) + "...",
      filename,
    });

    const uploadedUrl = await fluxKontextService.uploadReferenceImageToS3(
      imageUrl,
      userId,
      filename
    );

    console.log("[flux-kontext/upload-reference] Successfully uploaded:", {
      uploadedUrl: uploadedUrl.substring(0, 100) + "...",
    });

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: uploadedUrl,
      },
    });
  } catch (error) {
    console.error("[flux-kontext/upload-reference] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to upload reference image",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Flux Kontext Reference Image Upload API",
      description: "POST to upload reference images for Flux Kontext editing",
      requiredFields: ["imageUrl"],
      optionalFields: ["filename"],
    },
    { status: 200 }
  );
}
