import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { s3Utils } from "@/lib/s3-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, assetId } = await request.json();

    if (!url && !assetId) {
      return NextResponse.json(
        { error: "Either URL or assetId is required" },
        { status: 400 }
      );
    }

    let assetUrl = url;

    // If assetId is provided, get the URL from the database
    if (assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { url: true, userId: true },
      });

      if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      // Check if the user owns this asset
      if (asset.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      assetUrl = asset.url;
    }

    // Delete from S3
    await s3Utils.deleteAssetFromUrl(assetUrl);

    // Delete from database if assetId was provided
    if (assetId) {
      await prisma.asset.delete({
        where: { id: assetId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting from S3:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
