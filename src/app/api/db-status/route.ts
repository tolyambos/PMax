import { checkDatabaseConnection } from "@/utils/db-check";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const isConnected = await checkDatabaseConnection();

    let projectCount = 0;
    let userCount = 0;

    if (isConnected) {
      try {
        // Get basic stats as well
        projectCount = await prisma.project.count();
        userCount = await prisma.user.count();

        console.log(
          `Database contains ${projectCount} projects and ${userCount} users`
        );
      } catch (statsError) {
        console.error("Error fetching database stats:", statsError);
      }
    }

    return NextResponse.json({
      status: isConnected ? "connected" : "disconnected",
      database: "PostgreSQL",
      timestamp: new Date().toISOString(),
      details: {
        projectCount,
        userCount,
      },
    });
  } catch (error) {
    console.error("Error checking database status:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to check database connection",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
