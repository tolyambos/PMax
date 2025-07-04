import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    success: true,
    sceneId: params.id,
    message: "Test route working - route structure is correct"
  });
}
