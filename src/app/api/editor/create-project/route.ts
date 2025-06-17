import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";

export async function POST(req: Request) {
  try {
    // Get user ID for development
    const devUserId = "dev-user-id";

    // For data validation
    const body = await req.json();

    // Create a project
    const project = await prisma.project.create({
      data: {
        name: body.name || "Editor Project",
        description: body.description || "Created from editor",
        userId: devUserId,
        format: body.format || "9:16",
      },
    });

    console.log(`Created project from editor with ID: ${project.id}`);

    // Return the project data
    return NextResponse.json({
      success: true,
      id: project.id,
      name: project.name,
      description: project.description,
      format: project.format,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating project from editor:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
