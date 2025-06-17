import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/utils/db";

/**
 * API route to get scenes for a project
 * Fetches data from PostgreSQL database
 */
export async function GET(req: Request) {
  try {
    // Get projectId from the URL
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Fetch scenes from database with their elements
    const scenes = await prisma.scene.findMany({
      where: {
        projectId: projectId,
      },
      include: {
        elements: true,
      },
      orderBy: {
        order: "asc",
      },
    });

    // If scenes exist in database, return them
    if (scenes && scenes.length > 0) {
      return NextResponse.json({
        useClientStorage: false,
        projectId,
        scenes,
        message: "Scenes retrieved from database",
      });
    }

    // If no scenes in database, instruct client to use localStorage data
    return NextResponse.json({
      useClientStorage: true,
      projectId,
      message:
        "No scenes found in database. Use client-side scenes from storage.",
    });
  } catch (error) {
    console.error("Error fetching scenes:", error);

    return NextResponse.json(
      { error: "Failed to fetch scenes" },
      { status: 500 }
    );
  }
}
