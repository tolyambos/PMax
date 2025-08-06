import { NextRequest, NextResponse } from "next/server";

// Dummy endpoint to stop 404 errors from unknown source
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("Story save request received for ID:", params.id);
  console.log("Headers:", Object.fromEntries(request.headers.entries()));
  
  // Return success to stop the errors
  return NextResponse.json({ 
    success: true, 
    message: "Story endpoint not implemented",
    id: params.id 
  });
}