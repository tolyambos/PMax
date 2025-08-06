import OpenAI from "openai";

export interface ImageQualityResult {
  isGoodQuality: boolean;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
  colorMismatch?: {
    expected: string[];
    found: string[];
    severity: "critical" | "minor";
  };
}

export async function analyzeImageQuality(
  imageUrl: string,
  prompt?: string
): Promise<ImageQualityResult> {
  try {
    console.log(
      "[analyzeImageQuality] Starting analysis for:",
      imageUrl.substring(0, 100) + "..."
    );

    // Validate image URL
    if (!imageUrl || !imageUrl.startsWith("http")) {
      console.error("[analyzeImageQuality] Invalid image URL:", imageUrl);
      return {
        isGoodQuality: true,
        qualityScore: 7,
        issues: [],
        suggestions: [],
        colorMismatch: undefined,
      };
    }

    // Extract color requirements from prompt if provided
    let colorRequirements: string[] = [];
    if (prompt) {
      // Common color words and patterns
      const colorPatterns = [
        /(\w+)\s+background/gi,
        /background\s+(?:is\s+)?(\w+)/gi,
        /(\w+)\s+color\s+background/gi,
        /solid\s+(\w+)/gi,
        /on\s+(\w+)\s+background/gi,
        /(?:HEX|hex)?[#\s]*([A-Fa-f0-9]{6})\b/gi,  // Also match #FFFFFF without HEX prefix
        /#([A-Fa-f0-9]{6})\b/gi,  // Direct hex color matching
        /\b(red|green|blue|yellow|orange|purple|pink|black|white|gray|grey|brown|beige|cream|navy|teal|cyan|magenta|maroon|olive|lime|aqua|silver|gold|bronze)\b/gi,
      ];

      colorPatterns.forEach((pattern) => {
        const matches = Array.from(prompt.matchAll(pattern));
        for (const match of matches) {
          const color = match[1]?.toLowerCase();
          if (color && !colorRequirements.includes(color)) {
            // If it's a hex color, also add the color name if we know it
            if (/^[a-f0-9]{6}$/i.test(color)) {
              colorRequirements.push(`#${color}`);
              // Map common hex colors to names
              const hexToName: Record<string, string> = {
                'ffffff': 'white',
                '000000': 'black',
                'ff0000': 'red',
                '00ff00': 'green',
                '0000ff': 'blue',
                'ffff00': 'yellow',
                'ffa500': 'orange',
                '800080': 'purple',
                'ffc0cb': 'pink',
                '808080': 'gray',
                'a52a2a': 'brown',
                'f5f5dc': 'beige',
                '000080': 'navy',
                '008080': 'teal',
                '00ffff': 'cyan',
                'ff00ff': 'magenta',
              };
              const colorName = hexToName[color.toLowerCase()];
              if (colorName && !colorRequirements.includes(colorName)) {
                colorRequirements.push(colorName);
              }
            } else {
              colorRequirements.push(color);
            }
          }
        }
      });

      console.log(
        "[analyzeImageQuality] Extracted color requirements:",
        colorRequirements
      );
    }

    // Check if OpenAI API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.warn(
        "[analyzeImageQuality] No OpenAI API key found, skipping quality analysis"
      );
      return {
        isGoodQuality: true,
        qualityScore: 7,
        issues: [],
        suggestions: [],
        colorMismatch: undefined,
      };
    }

    // Check if this is an S3 URL and generate presigned URL if needed
    let analysisImageUrl = imageUrl;
    const isS3Url =
      imageUrl.includes("wasabisys.com") ||
      imageUrl.includes("amazonaws.com") ||
      imageUrl.includes("s3.");

    if (isS3Url) {
      console.log(
        "[analyzeImageQuality] S3 URL detected, generating presigned URL for OpenAI access..."
      );

      try {
        // Import S3 utils
        const { s3Utils } = await import("@/lib/s3-utils");

        // Extract bucket and key from the URL
        const { bucket, bucketKey } =
          s3Utils.extractBucketAndKeyFromUrl(imageUrl);

        // Generate presigned URL that OpenAI can access
        const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey);
        analysisImageUrl = presignedUrl;

        console.log(
          "[analyzeImageQuality] Generated presigned URL for OpenAI"
        );
      } catch (s3Error) {
        console.error("[analyzeImageQuality] Failed to generate presigned URL:", s3Error);
        // Continue with original URL as fallback
      }
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image for quality issues, with special attention to product integrity${colorRequirements.length > 0 ? " and color requirements" : ""}. Focus on:

CRITICAL - Product Integrity:
- Are all product parts present and correctly formed? (e.g., headphones have TWO ear cups, watches have complete bands, etc.)
- Is the product anatomically/structurally correct?
- Are there any missing, duplicated, or malformed parts?
- Does the product look realistic and properly assembled?

CRITICAL - Brand/Logo Check:
- Are there any visible brand names, logos, or trademarks on the product?
- Are there any recognizable brand symbols or text?
- Is the product generic and unbranded as required?
- If any branding is detected, identify what brand/logo is visible

${
  colorRequirements.length > 0
    ? `CRITICAL - Color Requirements:
- Expected colors: ${colorRequirements.join(", ")}
- Does the image contain these specific colors (especially for backgrounds)?
- Are the colors accurate to what was requested?
- If a specific background color was requested, is it present?

`
    : ""
}Technical Quality:
- Sharpness and focus quality
- Lighting and exposure
- Absence of visual artifacts, distortions, or AI glitches
- Color accuracy and saturation
- Text clarity (if any text is present, is it readable and not garbled?)

Professional Standards:
- Overall aesthetic appeal for advertising
- Clean, professional appearance
- Consistent style throughout the image

Please respond in this exact JSON format:
{
  "qualityScore": <number 1-10>,
  "isGoodQuality": <boolean>,
  "issues": ["list", "of", "specific", "problems", "found"],
  "suggestions": ["list", "of", "specific", "improvements", "for", "better", "results"]${
    colorRequirements.length > 0
      ? `,
  "colorAnalysis": {
    "expectedColors": ${JSON.stringify(colorRequirements)},
    "foundColors": ["list", "of", "dominant", "colors", "found"],
    "colorMatch": <boolean>,
    "colorMismatchSeverity": "critical" | "minor" | "none"
  }`
      : ""
  }
}

SCORING GUIDELINES:
- Score 9-10: Exceptional quality, perfect product structure, exact color match, no issues
- Score 8: Good quality, minor imperfections acceptable, slight color variations OK
- Score 7: Acceptable quality, some minor issues but usable
- Score 5-6: Noticeable issues but not critical (slightly off colors, minor artifacts)
- Score 3-4: Significant issues (wrong anatomy, major color mismatch, heavy artifacts)
- Score 1-2: Unusable (missing parts, completely wrong colors, severe distortions)

IMPORTANT: 
- If product has MAJOR anatomical issues (missing parts, wrong structure), score should be 4 or below
- If ANY brand names/logos are visible, reduce score by 3-4 points
- For color mismatches: Minor variations (similar shade) = reduce by 1 point. Major differences (wrong color family) = reduce by 3 points
- Be realistic: Most AI-generated images will score 7-9. Perfect 10s are rare.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: analysisImageUrl,
                  detail: "low",
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      console.log("[analyzeImageQuality] Raw OpenAI response:", response);

      // Try to parse the structured response from OpenAI
      let analysis;
      try {
        const responseText = response.choices?.[0]?.message?.content || "";
        console.log(
          "[analyzeImageQuality] Parsing response text:",
          responseText
        );

        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
          console.log("[analyzeImageQuality] Parsed JSON analysis:", analysis);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        console.warn(
          "[analyzeImageQuality] Failed to parse structured response:",
          parseError
        );

        // Fallback: analyze the text for quality indicators
        const responseText = (
          response.choices?.[0]?.message?.content || ""
        ).toLowerCase();
        const qualityIssues = [
          "missing",
          "malformed",
          "incomplete",
          "one ear",
          "single",
          "broken",
          "distorted",
          "unrealistic",
          "anatomically incorrect",
          "structurally wrong",
          "artifact",
          "blurry",
          "low quality",
          "overexposed",
          "underexposed",
          "garbled text",
          "brand",
          "logo",
          "trademark",
          "branded",
          "nike",
          "adidas",
          "apple",
          "samsung",
          "sony",
          "microsoft",
          "google",
          "amazon",
        ];

        const foundIssues = qualityIssues.filter((issue) =>
          responseText.includes(issue)
        );
        const hasIssues = foundIssues.length > 0;

        analysis = {
          qualityScore: hasIssues ? 5 : 8,
          isGoodQuality: !hasIssues,
          issues: hasIssues ? foundIssues : [],
          suggestions: hasIssues
            ? [
                "Improve image quality",
                "Enhance lighting",
                "Better composition",
              ]
            : [],
        };

        console.log(
          "[analyzeImageQuality] Fallback analysis created:",
          analysis
        );
      }

      // Handle color analysis if present
      let colorMismatch = undefined;
      if (analysis.colorAnalysis && colorRequirements.length > 0) {
        const colorMatch = analysis.colorAnalysis.colorMatch ?? true;
        const severity = analysis.colorAnalysis.colorMismatchSeverity || "none";

        if (!colorMatch && severity !== "none") {
          colorMismatch = {
            expected:
              analysis.colorAnalysis.expectedColors || colorRequirements,
            found: analysis.colorAnalysis.foundColors || [],
            severity: severity as "critical" | "minor",
          };

          // Add color mismatch to issues if not already present
          if (
            !analysis.issues.some((issue: string) =>
              issue.toLowerCase().includes("color")
            )
          ) {
            analysis.issues.push(
              `Color mismatch: expected ${colorRequirements.join(", ")} but found ${(analysis.colorAnalysis.foundColors || []).join(", ")}`
            );
          }

          // Add suggestion to fix colors
          if (
            !analysis.suggestions.some((s: string) =>
              s.toLowerCase().includes("color")
            )
          ) {
            analysis.suggestions.push(
              `Use the exact colors specified: ${colorRequirements.join(", ")}`
            );
          }
        }
      }

      // Ensure we have all required fields with proper types
      const finalAnalysis = {
        qualityScore: Number(analysis.qualityScore) || 7,
        isGoodQuality: Boolean(
          analysis.isGoodQuality ?? analysis.qualityScore >= 7
        ),
        issues: Array.isArray(analysis.issues) ? analysis.issues : [],
        suggestions: Array.isArray(analysis.suggestions)
          ? analysis.suggestions
          : [],
        colorMismatch,
      };

      console.log(
        "[analyzeImageQuality] Final analysis result:",
        finalAnalysis
      );
      return finalAnalysis;
    } catch (openaiError) {
      console.error("[analyzeImageQuality] OpenAI API error:", openaiError);

      // Fallback: assume good quality if analysis fails
      return {
        isGoodQuality: true,
        qualityScore: 7,
        issues: [],
        suggestions: [],
        colorMismatch: undefined,
      };
    }
  } catch (error) {
    console.error(
      "[analyzeImageQuality] Error analyzing image quality:",
      error
    );
    // Fallback: assume good quality on error
    return {
      isGoodQuality: true,
      qualityScore: 7,
      issues: [],
      suggestions: [],
      colorMismatch: undefined,
    };
  }
}
