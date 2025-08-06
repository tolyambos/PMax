import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, canCreateProject } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user and get permissions
    const user = await requireAuth();

    // Check if user can create projects
    const canCreate = await canCreateProject(user);
    if (!canCreate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: canCreate.reason,
          currentCount: canCreate.currentCount,
          maxProjects: canCreate.maxProjects,
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        {
          success: false,
          error: "Project name is required",
        },
        { status: 400 }
      );
    }

    console.log(
      `Creating project via API for user ${user.id} with name: ${body.name}. Current projects: ${canCreate.currentCount}/${canCreate.maxProjects}`
    );

    // Create the project
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description || "",
        format: body.format || "9:16",
        userId: user.id, // Use authenticated user ID
      },
    });

    console.log(`Project created successfully with ID: ${project.id}`);

    // Return safe project data
    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description || "",
        format: project.format,
        duration: project.duration,
        thumbnail: project.thumbnail || "",
        videoUrl: project.videoUrl || "",
        published: project.published,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating project:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();

    // Get all projects for the authenticated user
    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      include: {
        scenes: {
          select: {
            id: true,
          },
        },
        bulkVideos: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    console.log(
      `Found ${projects.length} projects for user ${user.id} via API`
    );

    // Map to a safe format for serialization
    const safeProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description || "",
      format: project.format,
      duration: project.duration,
      thumbnail: project.thumbnail || "",
      videoUrl: project.videoUrl || "",
      published: project.published,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      scenes: project.scenes || [],
      bulkVideos: project.bulkVideos || [],
      isBulkProject: project.projectType === "bulk-video" || (project.bulkVideos && project.bulkVideos.length > 0),
    }));

    return NextResponse.json({
      success: true,
      projects: safeProjects,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching projects via API:", error);

    return NextResponse.json(
      {
        success: false,
        projects: [],
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
