import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[test-json] Testing JSON save for scene: ${params.id}`);
    
    // Simple test data
    const testData = [
      {
        id: "test-1",
        url: "https://example.com/test.jpg",
        prompt: "test prompt",
        timestamp: Date.now(),
        isOriginal: false
      }
    ];
    
    console.log(`[test-json] Test data:`, testData);
    console.log(`[test-json] JSON string:`, JSON.stringify(testData));
    
    // Try to update the scene with test JSON data
    const result = await prisma.scene.update({
      where: {
        id: params.id,
      },
      data: {
        backgroundHistory: testData,
      },
    });
    
    console.log(`[test-json] Update successful`);
    
    return NextResponse.json({
      success: true,
      message: "JSON test successful",
      testData,
    });

  } catch (error) {
    console.error("[test-json] Error:", error);
    console.error("[test-json] Full error details:", {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code,
      meta: (error as any)?.meta,
      cause: (error as any)?.cause,
      clientVersion: (error as any)?.clientVersion
    });
    
    return NextResponse.json(
      { 
        error: "JSON test failed",
        details: (error as any)?.message || "Unknown error",
        fullError: error
      },
      { status: 500 }
    );
  }
}