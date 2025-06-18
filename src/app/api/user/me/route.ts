import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Convert BigInt to string for JSON serialization
    const serializedUser = {
      ...user,
      permissions: user.permissions.map((permission) => ({
        ...permission,
        maxAssetStorage: permission.maxAssetStorage.toString(),
      })),
    };

    return NextResponse.json({ user: serializedUser });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
