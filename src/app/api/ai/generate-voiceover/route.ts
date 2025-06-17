import { NextResponse } from "next/server";
import { generateAIVoiceover } from "@/app/utils/ai";
import { z } from "zod";

// Define request schema with Zod
const RequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional().default("eleven_multilingual_v2"),
});

export async function POST(req: Request) {
  try {
    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate request using Zod
    try {
      body = RequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return NextResponse.json(
          { error: "Validation error", details: errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    const { text, voice } = body;

    // Generate voiceover from the text
    const result = await generateAIVoiceover(text, voice);

    return NextResponse.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating voiceover:", error);

    // Determine error type
    const isClientError =
      error instanceof Error &&
      (error.message.includes("Invalid") ||
        error.message.includes("required") ||
        error.message.includes("empty"));

    return NextResponse.json(
      {
        error: isClientError ? error.message : "Failed to generate voiceover",
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: isClientError ? 400 : 500 }
    );
  }
}
