import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    if (process.env.ENABLE_MOCK_AUTH !== "true") {
      return NextResponse.json(
        { error: "Mock auth is disabled" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email = "dev@example.com", name = "Development User" } = body;

    // Create a mock session
    const mockUser = {
      id: "dev-user-id",
      email,
      name,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=ffffff`,
    };

    // Set a simple session cookie
    const cookieStore = cookies();
    cookieStore.set("mock-session", JSON.stringify(mockUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      success: true,
      user: mockUser,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    console.error("Mock signin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
