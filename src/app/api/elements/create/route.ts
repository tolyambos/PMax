import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Schema for element creation - enhanced to properly handle content
const ElementCreateSchema = z.object({
  sceneId: z.string().min(1),
  type: z.string().min(1),
  content: z.union([z.string().optional(), z.any()]), // Accept either string or any other type
  x: z.coerce.number().default(0), // Use float for percentage (0-100)
  y: z.coerce.number().default(0), // Use float for percentage (0-100)
  width: z.coerce.number().nullable().optional(), // Use float for percentage (0-100)
  height: z.coerce.number().nullable().optional(), // Use float for percentage (0-100)
  rotation: z.coerce.number().default(0),
  opacity: z.coerce.number().default(1.0),
  zIndex: z.coerce.number().int().default(0),
  assetId: z.string().optional().nullable(),
});

// API endpoint to create an element directly
export async function POST(req: Request) {
  try {
    // Parse and validate request
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    console.log("Element create request received:", body);

    // Validate request
    try {
      console.log("Validating element data:", body);
      body = ElementCreateSchema.parse(body);
      console.log("Validation successful:", body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        console.error("Validation error details:", errors);

        return NextResponse.json(
          { error: "Validation error", details: errors },
          { status: 400 }
        );
      }

      console.error("Unknown validation error:", validationError);

      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    // Check if the scene exists
    const scene = await prisma.scene.findUnique({
      where: { id: body.sceneId },
    });

    if (!scene) {
      console.log(
        `Scene with ID ${body.sceneId} not found, looking for alternative scene`
      );

      // Try to find the first scene in the project
      // We need to extract the project ID from the scene ID format
      // Assuming scene IDs follow a pattern where they belong to a project
      const scenes = await prisma.scene.findMany({
        orderBy: { order: "asc" },
        take: 1,
      });

      if (scenes.length === 0) {
        return NextResponse.json(
          { error: `No scenes found in the database` },
          { status: 404 }
        );
      }

      // Use the first scene instead
      body.sceneId = scenes[0].id;
      console.log(`Using alternative scene ID: ${body.sceneId}`);
    }

    // Create the element
    console.log("Creating element:", body);

    // Process content to ensure it's properly standardized and un-nested
    let processedContent;

    // Define a type for element content that can handle different formats
    type ElementContent =
      | string
      | {
          text?: string;
          style?: {
            fontFamily?: string | number;
            fontWeight?: string | number;
            fontSize?: string | number;
            color?: string;
            textShadow?: string;
            [key: string]: any;
          };
          shapeType?: string;
          ctaType?: string;
          [key: string]: any;
        }
      | null;

    // Helper function to safely process element content to ensure style consistency
    const unnestContent = (content: ElementContent) => {
      console.log(
        "UNNESTING:",
        typeof content,
        content
          ? typeof content === "string"
            ? content.substring?.(0, 50)
            : JSON.stringify(content).substring(0, 50)
          : content
      );

      // Special case: content is an object with a text field that contains a JSON string
      if (
        typeof content === "object" &&
        content !== null &&
        typeof content.text === "string" &&
        content.text.trim().startsWith("{")
      ) {
        try {
          // Try to parse the nested JSON inside the text field
          const innerContent = JSON.parse(content.text);
          if (typeof innerContent === "object" && innerContent !== null) {
            // Found a nested JSON structure - this is the actual content
            console.log(
              "Found nested JSON in content.text, using that instead"
            );

            // Create a properly structured result object
            const result: {
              text: string;
              style: any;
              shapeType?: string;
              ctaType?: string;
              [key: string]: any;
            } = {
              text: innerContent.text || content.text,
              style: {
                ...(innerContent.style || {}),
                // Important: Ensure font properties are preserved
                fontFamily:
                  innerContent.style?.fontFamily || content.style?.fontFamily,
                fontWeight:
                  innerContent.style?.fontWeight || content.style?.fontWeight,
                textShadow:
                  innerContent.style?.textShadow || content.style?.textShadow,
              },
            };

            // Preserve other properties
            if (innerContent.shapeType)
              result.shapeType = innerContent.shapeType;
            if (innerContent.ctaType) result.ctaType = innerContent.ctaType;

            return JSON.stringify(result);
          }
        } catch (e) {
          console.error("Error parsing nested JSON in content.text:", e);
        }
      }

      // If content is already a properly formatted object, stringify it
      if (typeof content === "object" && content !== null) {
        // Ensure it has the expected structure
        const formattedContent: {
          text: string;
          style: any;
          shapeType?: string;
          ctaType?: string;
          [key: string]: any;
        } = {
          text: content.text || "",
          style: {
            ...(content.style || {}),
            // Important: Explicitly preserve font properties
            fontFamily: content.style?.fontFamily || undefined,
            fontWeight: content.style?.fontWeight || undefined,
            textShadow: content.style?.textShadow || undefined,
          },
        };

        // Preserve other properties
        if (content.shapeType) formattedContent.shapeType = content.shapeType;
        if (content.ctaType) formattedContent.ctaType = content.ctaType;

        // Log the formatted content for debugging
        console.log("Formatted content object:", {
          text: formattedContent.text,
          style: {
            fontFamily: formattedContent.style?.fontFamily,
            fontWeight: formattedContent.style?.fontWeight,
            textShadow: formattedContent.style?.textShadow,
            // Other style properties...
            color: formattedContent.style?.color,
            fontSize: formattedContent.style?.fontSize,
          },
        });

        return JSON.stringify(formattedContent);
      }

      // Handle string content
      if (typeof content === "string") {
        // If the content is already valid JSON, preserve all styles
        if (content.trim().startsWith("{")) {
          try {
            const parsedContent = JSON.parse(content);

            // If it has the expected structure (text & style), keep it as is
            if (
              parsedContent.text !== undefined ||
              parsedContent.style !== undefined
            ) {
              // Make sure both properties exist
              parsedContent.text = parsedContent.text || "";
              parsedContent.style = parsedContent.style || {};

              // Ensure font properties are preserved
              if (parsedContent.style) {
                // Explicitly preserve these properties
                parsedContent.style.fontFamily =
                  parsedContent.style.fontFamily || undefined;
                parsedContent.style.fontWeight =
                  parsedContent.style.fontWeight || undefined;
                parsedContent.style.textShadow =
                  parsedContent.style.textShadow || undefined;
              }

              return JSON.stringify(parsedContent);
            }

            // Otherwise wrap it
            return JSON.stringify({
              text: typeof parsedContent === "string" ? parsedContent : "",
              style: {},
            });
          } catch (e) {
            // Not valid JSON, wrap it in a text structure
            return JSON.stringify({ text: content, style: {} });
          }
        } else {
          // Plain text, wrap it
          return JSON.stringify({ text: content, style: {} });
        }
      }

      // Fallback
      return JSON.stringify({ text: String(content || ""), style: {} });
    };

    // Apply the unnesting logic
    processedContent = unnestContent(body.content);

    console.log(
      "FINAL PROCESSED CONTENT:",
      processedContent ? processedContent.substring(0, 100) : null
    );
    console.log("LENGTH:", processedContent ? processedContent.length : 0);

    try {
      // Parse to verify it's valid JSON
      const contentObj = JSON.parse(processedContent);
      console.log("PARSED CONTENT IS VALID:", {
        text: contentObj.text,
        style: {
          fontFamily: contentObj.style?.fontFamily,
          fontWeight: contentObj.style?.fontWeight,
          textShadow: contentObj.style?.textShadow,
          // Other key properties
          color: contentObj.style?.color,
          fontSize: contentObj.style?.fontSize,
        },
        shapeType: contentObj.shapeType,
        ctaType: contentObj.ctaType,
      });
    } catch (e) {
      console.error("INVALID JSON PRODUCED:", e);
    }

    const element = await prisma.element.create({
      data: {
        type: body.type,
        content: processedContent,
        x: parseFloat(String(body.x || 0)),
        y: parseFloat(String(body.y || 0)),
        width:
          body.width !== undefined && body.width !== null
            ? parseFloat(String(body.width))
            : null,
        height:
          body.height !== undefined && body.height !== null
            ? parseFloat(String(body.height))
            : null,
        rotation: parseFloat(String(body.rotation || 0)),
        opacity: parseFloat(String(body.opacity || 1.0)),
        zIndex: parseInt(String(body.zIndex || 0), 10),
        assetId: body.assetId,
        sceneId: body.sceneId,
      },
    });

    console.log("Element created successfully:", element);

    return NextResponse.json({
      success: true,
      message: "Element created successfully",
      element,
    });
  } catch (error) {
    console.error("Error creating element:", error);

    return NextResponse.json(
      { error: "Failed to create element" },
      { status: 500 }
    );
  }
}
