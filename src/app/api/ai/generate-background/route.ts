import { NextResponse } from "next/server";
import { generateBackgroundImage } from "@/app/utils/ai";
import { z } from "zod";
import { GENERATE_BACKGROUND_PROMPT } from "@/app/utils/prompts";

// Define request schema for background generation
const RequestSchema = z.object({
  prompt: z.string().min(3).max(1000),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("16:9"),
  style: z.string().optional(),
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

    // Log the request for debugging
    console.log("Background generation request:", body);

    // Validate request using Zod schema
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

    const { prompt, format } = body;

    // Get userId (dev-user-id for development, auth for production)
    const userId =
      process.env.NODE_ENV === "development" ? "dev-user-id" : "auth-user-id";

    // Generate background image from the prompt
    console.log(
      `Generating background in ${format} format with prompt: ${prompt}`
    );
    const background = await generateBackgroundImage(prompt, format, userId);

    return NextResponse.json({
      background,
      success: true,
      timestamp: new Date().toISOString(),
      format: format,
    });
  } catch (error) {
    console.error("Error generating background:", error);

    // Determine status code and message based on error
    const isClientError =
      error instanceof Error &&
      (error.message.includes("Invalid") || error.message.includes("required"));

    return NextResponse.json(
      {
        error: isClientError ? error.message : "Failed to generate background",
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: isClientError ? 400 : 500 }
    );
  }
}
