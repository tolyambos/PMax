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

    // Clear the mock session cookie
    const cookieStore = cookies();
    cookieStore.delete("mock-session");

    return NextResponse.json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("Mock signout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
