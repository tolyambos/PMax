import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";
import { auth } from "@clerk/nextjs";

/**
 * API route handler for fetching assets
 * GET /api/assets - Returns a list of all available assets
 */
export async function GET() {
  try {
    // Check authentication using Clerk (same as upload route)
    const authResult = auth();
    if (!authResult.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const clerkUserId = authResult.userId;

    // Get the database user ID from the Clerk user ID
    let userId: string;
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      userId = user.id;
    } catch (error) {
      console.error("Error finding user:", error);
      return NextResponse.json(
        { success: false, error: "Failed to authenticate user" },
        { status: 500 }
      );
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
