import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";
import { auth } from "@clerk/nextjs";

/**
 * API route handler for fetching assets
 * GET /api/assets - Returns a list of all available assets
 */
export async function GET() {
  try {
    // Get user ID - in development we use a dev user ID
    let userId: string;

    if (process.env.NODE_ENV === "development") {
      userId = "dev-user-id";
    } else {
      const authResult = auth();
      if (!authResult.userId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
      userId = authResult.userId;
    }

    // Fetch assets from the database
    const assets = await prisma.asset.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      assets,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}
