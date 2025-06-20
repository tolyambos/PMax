import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get project ID from query
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json({
        exists: false,
        message: "No project ID provided",
      });
    }

    console.log(`Checking if project exists with ID: ${projectId}`);

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        name: true,
        userId: true,
        createdAt: true,
        _count: {
          select: {
            scenes: true,
          },
        },
      },
    });

    if (project) {
      console.log(
        `Found project: ${project.id}, name: ${project.name}, scenes: ${project._count.scenes}`
      );
      return NextResponse.json({
        exists: true,
        id: project.id,
        name: project.name,
        userId: project.userId,
        createdAt: project.createdAt,
        sceneCount: project._count.scenes,
      });
    } else {
      console.log(`Project not found with ID: ${projectId}`);

      // Try searching with like operator for similar IDs
      console.log("Looking for projects with similar IDs...");

      // Use Prisma's startsWith to find similar IDs
      // This can be useful if there's any character encoding issue
      const similarProjects = await prisma.project.findMany({
        where: {
          id: {
            startsWith: projectId.substring(0, 5), // Try matching first 5 chars
          },
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        take: 5,
      });

      if (similarProjects.length > 0) {
        console.log(
          "Found similar projects:",
          similarProjects.map((p) => p.id)
        );
        return NextResponse.json({
          exists: false,
          message: `Project with ID ${projectId} not found exactly, but found similar projects`,
          similarProjects,
        });
      }

      return NextResponse.json({
        exists: false,
        message: `Project with ID ${projectId} not found`,
      });
    }
  } catch (error) {
    console.error("Error checking project:", error);
    return NextResponse.json(
      {
        exists: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
