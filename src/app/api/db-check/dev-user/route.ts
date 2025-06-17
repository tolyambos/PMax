import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";

export async function GET() {
  try {
    // Check if dev user exists
    const devUser = await prisma.user.findUnique({
      where: { id: "dev-user-id" },
    });

    if (devUser) {
      return NextResponse.json({
        status: "ok",
        exists: true,
        userId: devUser.id,
        name: devUser.name,
        createdAt: devUser.createdAt,
      });
    } else {
      // Create dev user if it doesn't exist
      try {
        const newUser = await prisma.user.create({
          data: {
            id: "dev-user-id",
            name: "Development User",
            email: "dev@example.com",
          },
        });

        return NextResponse.json({
          status: "ok",
          exists: false,
          created: true,
          userId: newUser.id,
          name: newUser.name,
          createdAt: newUser.createdAt,
        });
      } catch (createError) {
        return NextResponse.json(
          {
            status: "error",
            exists: false,
            created: false,
            error:
              createError instanceof Error
                ? createError.message
                : String(createError),
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error("Database dev user check error:", error);

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
