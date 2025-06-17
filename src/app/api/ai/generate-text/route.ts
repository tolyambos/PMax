import { NextResponse } from "next/server";
import { openAIService } from "@/app/utils/openai";
import { z } from "zod";

// Define request schema with Zod
const RequestSchema = z.object({
  prompt: z.string().min(1).max(8000),
  maxTokens: z.number().min(1).max(200).optional().default(50),
  temperature: z.number().min(0).max(2).optional().default(0.7),
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

    // Log request for debugging
    console.log("Text generation request received:", {
      promptLength: body.prompt?.length || 0,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    });

    // Validate request using Zod
    try {
      body = RequestSchema.parse(body);
    } catch (validationError) {
      console.error("Validation error in generate-text:", validationError);

      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        console.error("Validation errors:", errors);

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

    const { prompt, maxTokens, temperature } = body;

    // Generate text using OpenAI service
    const completion = await openAIService.createCompletion({
      prompt,
      max_tokens: maxTokens,
      temperature,
    });

    // Extract text from the response
    const generatedText = completion.choices[0]?.text || "";

    return NextResponse.json({
      success: true,
      text: generatedText,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating text:", error);

    return NextResponse.json(
      {
        error: "Failed to generate text",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
