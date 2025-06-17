import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    if (process.env.ENABLE_MOCK_AUTH !== "true") {
      return NextResponse.json({ user: null });
    }

    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("mock-session");

    if (!sessionCookie?.value) {
      return NextResponse.json({ user: null });
    }

    try {
      const user = JSON.parse(sessionCookie.value);
      return NextResponse.json({ user });
    } catch (parseError) {
      console.error("Error parsing session cookie:", parseError);
      return NextResponse.json({ user: null });
    }
  } catch (error) {
    console.error("Mock session check error:", error);
    return NextResponse.json({ user: null });
  }
}
