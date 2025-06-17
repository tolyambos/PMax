import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Basic health check
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "PMax Video Editor",
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Health check failed" },
      { status: 500 }
    );
  }
}
