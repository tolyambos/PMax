import { NextRequest, NextResponse } from "next/server";
import { getExportProgress } from "@/app/utils/bulk-export-progress";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exportId = searchParams.get('exportId');

  console.log(`[BULK-EXPORT-STATUS] Request for exportId: ${exportId}`);

  if (!exportId) {
    console.log(`[BULK-EXPORT-STATUS] Missing exportId`);
    return NextResponse.json({ error: 'Missing exportId' }, { status: 400 });
  }

  const progress = getExportProgress(exportId);
  console.log(`[BULK-EXPORT-STATUS] Progress for ${exportId}:`, progress ? 'found' : 'not found');
  
  if (!progress) {
    console.log(`[BULK-EXPORT-STATUS] Export not found: ${exportId}`);
    return NextResponse.json({ error: 'Export not found' }, { status: 404 });
  }

  return NextResponse.json(progress);
}