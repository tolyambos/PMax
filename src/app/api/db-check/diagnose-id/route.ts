import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get project ID from query
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json(
        {
          error: "No project ID provided",
        },
        { status: 400 }
      );
    }

    console.log(`Diagnostic check for ID: ${projectId}`);

    // Convert to different formats for testing
    const diagnostics = {
      originalId: projectId,
      urlDecoded: decodeURIComponent(projectId),
      trimmed: projectId.trim(),
      base64Encoded: Buffer.from(projectId).toString("base64"),
      base64Decoded: Buffer.from(projectId, "base64").toString("utf-8"),
      idChars: projectId
        .split("")
        .map((c) => ({ char: c, code: c.charCodeAt(0) })),
      length: projectId.length,
      pattern: projectId.match(/^[a-zA-Z0-9]+$/)
        ? "alphanumeric"
        : "contains-special-chars",
    };

    // Check if any project has this exact ID
    const exactMatch = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    // Find similar projects for comparison
    const similarProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    return NextResponse.json({
      diagnostics,
      exactMatch,
      similarProjects,
      success: true,
    });
  } catch (error) {
    console.error("ID diagnostic error:", error);
    return NextResponse.json(
      {
        error: String(error),
      },
      { status: 500 }
    );
  }
}
