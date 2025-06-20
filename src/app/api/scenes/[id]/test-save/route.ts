import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[test-save] Testing save for scene: ${params.id}`);

    // Create a simple test history entry
    const testEntry = {
      id: `test-${Date.now()}`,
      url: "https://example.com/test.jpg",
      prompt: "Test entry",
      timestamp: new Date().toISOString(),
      isOriginal: false,
    };

    // Get current scene
    const scene = await prisma.scene.findFirst({
      where: { id: params.id },
      select: { backgroundHistory: true },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Parse existing history
    let currentHistory = [];
    if (scene.backgroundHistory) {
      try {
        currentHistory =
          typeof scene.backgroundHistory === "string"
            ? JSON.parse(scene.backgroundHistory)
            : scene.backgroundHistory;
      } catch (error) {
        console.error("Error parsing existing history:", error);
        currentHistory = [];
      }
    }

    // Add test entry
    const updatedHistory = [...currentHistory, testEntry];

    // Save to database
    await prisma.scene.update({
      where: { id: params.id },
      data: { backgroundHistory: JSON.stringify(updatedHistory) },
    });

    console.log(`[test-save] Successfully saved test entry`);

    return NextResponse.json({
      success: true,
      message: "Test entry saved",
      previousCount: currentHistory.length,
      newCount: updatedHistory.length,
      testEntry,
    });
  } catch (error) {
    console.error("[test-save] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
