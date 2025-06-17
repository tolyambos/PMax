import { NextResponse } from "next/server";
import { prisma } from "@/app/utils/db";
import { auth } from "@clerk/nextjs";

/**
 * DELETE /api/assets/[id] - Delete a specific asset
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const assetId = params.id;

    // First verify the asset exists and belongs to the user
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        userId: userId,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    // Check if the asset is being used by any elements
    const elementsUsingAsset = await prisma.element.findMany({
      where: {
        assetId: assetId,
      },
    });

    if (elementsUsingAsset.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete asset - it is being used in one or more scenes",
          usedInElements: elementsUsingAsset.length,
        },
        { status: 400 }
      );
    }

    // Delete the asset from the database
    await prisma.asset.delete({
      where: {
        id: assetId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Asset deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
