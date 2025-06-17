import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";

export async function GET() {
  try {
    // Attempt to connect to the database
    const users = await prisma.user.findMany({
      take: 1,
    });

    // Attempt to get projects count
    const projectCount = await prisma.project.count();

    return NextResponse.json({
      status: "ok",
      connected: true,
      users: users.length,
      projects: projectCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return NextResponse.json(
      {
        status: "error",
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
