import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`[SIMPLE-TEST] Route called with ID: ${params.id}`);
  
  return NextResponse.json({
    success: true,
    message: "Simple test route working",
    sceneId: params.id,
    timestamp: new Date().toISOString()
  });
}
