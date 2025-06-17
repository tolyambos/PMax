import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { id, email, name } = body;

    if (!id || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (existingUser) {
      // User already exists, just return success
      return NextResponse.json({
        success: true,
        message: "User already exists",
        user: existingUser,
      });
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        id,
        email,
        name,
      },
    });

    console.log("Created mock user:", user);

    return NextResponse.json({
      success: true,
      message: "Mock user created successfully",
      user,
    });
  } catch (error) {
    console.error("Error creating mock user:", error);
    return NextResponse.json(
      { error: "Failed to create mock user" },
      { status: 500 }
    );
  }
}
