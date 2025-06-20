import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Find most recent project
    const recentProjects = await prisma.project.findMany({
      where: {
        userId: "dev-user-id",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    });

    if (recentProjects.length > 0) {
      const project = recentProjects[0];
      return NextResponse.json({
        exists: true,
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
      });
    } else {
      return NextResponse.json({
        exists: false,
        message: "No recent projects found",
      });
    }
  } catch (error) {
    console.error("Error checking recent projects:", error);
    return NextResponse.json(
      {
        exists: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
