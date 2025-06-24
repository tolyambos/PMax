import { NextResponse } from "next/server";
import { getAllExports } from "@/app/utils/bulk-export-progress";

export async function GET() {
  // This is a debug endpoint to check what exports are in memory
  const exportData = getAllExports();
  
  return NextResponse.json({
    ...exportData,
    timestamp: new Date().toISOString()
  });
}