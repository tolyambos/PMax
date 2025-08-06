/**
 * This file contains all prompts used in the application.
 * Centralizing prompts makes it easier to edit and maintain them.
 */

/**
 * Get detailed style-specific instructions for image generation
 */
export function getStyleInstructions(style: string): string {
  const styleGuides: Record<string, string> = {
    cinematic: `Dramatic lighting, moody atmosphere, dynamic angles, high contrast, cinematic colors`,

    realistic: `Natural lighting, authentic textures, realistic shadows, true colors, documentary style`,

    minimalist: `Clean composition, negative space, limited colors, soft lighting, essential elements only`,

    vibrant: `Bold saturated colors, bright lighting, high contrast, energetic composition, eye-catching`,

    "3D rendered": `3D graphics, perfect surfaces, studio lighting, clean renders, futuristic elements`,
  };

  return styleGuides[style] || styleGuides["realistic"];
}

/**
 * Prompt for generating video animation from an image prompt
 */
export const VIDEO_PROMPT_GENERATION = `You are a video motion expert specializing in Runway Gen-4 video generation. Your task is to transform a detailed image prompt into an effective video generation prompt that will create compelling motion for the scene.

INPUT IMAGE PROMPT:
{imagePrompt}

GUIDELINES FOR VIDEO PROMPT CREATION:
1. Focus primarily on describing MOTION, not static elements
2. Use simple, direct language that describes specific physical movements
3. Refer to subjects in general terms (e.g., "the subject", "the woman", "the car")
4. Include only 1-3 key motion elements to avoid conflicting instructions
5. Structure the prompt in this order:
   - Subject motion (how characters/objects move)
   - Scene motion (how environment elements react)
   - Camera motion (if any)
   - Style descriptor (e.g., "cinematic live-action", "smooth animation")

MOTION TYPES TO CONSIDER:
- Subject Motion: Describe how characters or objects should move (e.g., "the woman smiles and waves", "the car drives slowly across the scene")
- Scene Motion: Describe environmental elements (e.g., "dust trails behind as they move", "leaves flutter in the breeze")
- Camera Motion: Use terms like "locked camera", "slow pan", "tracking shot", "dolly in", "handheld"

BEST PRACTICES:
- Use positive phrasing only (describe what SHOULD happen, not what shouldn't)
- Keep the prompt under 100 words for best results
- Focus on a single scene with consistent motion
- Avoid overly complex sequences or multiple scene changes
- Don't repeat details already visible in the image

EXAMPLES OF EFFECTIVE VIDEO PROMPTS:
1. "The woman smiles and nods slightly. Her hair gently moves in the breeze. Locked camera. Cinematic live-action."
2. "The mechanical bull runs across the desert. Dust trails behind it. The camera tracks the movement. Cinematic live-action."
3. "The pile of rocks transforms into a humanoid figure. The rock creature walks forward. Locked camera. Photorealistic animation."

Create a concise, effective video prompt for Runway Gen-4 based on the input image prompt.`;

/**
 * Prompt for analyzing ad request and generating a comprehensive concept
 */
export const ANALYZE_AD_REQUEST_PROMPT = (
  productName: string,
  adType: string,
  targetAudience: string,
  keyPoints: string,
  style: string,
  format: string,
  numScenes: number,
  totalDuration: number
) => {
  const styleInstructions = getStyleInstructions(style);

  return `
Please analyze the following advertisement request and create a detailed concept:

- Product/Brand: ${productName}
- Ad Type: ${adType}
- Target Audience: ${targetAudience || "general audience"}
- Key Points to Highlight: ${keyPoints || "None specified"}
- Visual Style: ${style}
- Format: ${format}
- Number of Scenes: ${numScenes}
- Total Duration: ${totalDuration} seconds

VISUAL STYLE REQUIREMENTS - ${style.toUpperCase()}:
${styleInstructions}

Based on this information, especially the key points and the specific ${style} visual style requirements above, 
create a cohesive and creative ad narrative that incorporates all elements specified by the user.
All scenes must follow the ${style} style guidelines exactly.
`;
};

/**
 * Prompt for generating scene descriptions based on the analysis
 */
export const GENERATE_STORYBOARD_PROMPT = (
  analysisPrompt: string,
  numScenes: number,
  totalDuration: number,
  style?: string
) => {
  // Extract style from analysis prompt if not provided
  const styleMatch = analysisPrompt.match(/Visual Style: (\w+)/);
  const detectedStyle =
    style || (styleMatch ? styleMatch[1].toLowerCase() : "realistic");
  const styleInstructions = getStyleInstructions(detectedStyle);

  return `
${analysisPrompt}

Generate a complete storyboard with exactly ${numScenes} scenes.
The total duration must be exactly ${totalDuration} seconds.

MANDATORY STYLE REQUIREMENTS - ${detectedStyle.toUpperCase()}:
${styleInstructions}

PROFESSIONAL VISUAL QUALITY STANDARDS:
Sharp HD imagery, professional lighting, dynamic angles, high contrast, vibrant colors, commercial quality

CRITICAL: Every scene MUST incorporate the ${detectedStyle} style requirements listed above. 
The style should be evident in lighting, composition, color grading, and overall aesthetic.

For each scene, provide:
1. A detailed visual description that incorporates BOTH the ${detectedStyle} style AND professional quality standards
2. Duration in seconds (between 1-10 seconds per scene)

Make your scene descriptions as vivid and specific as possible, incorporating all the key points
and elements mentioned in the description. Be creative and make sure the images will be 
visually compelling with rich, detailed descriptions that follow the ${detectedStyle} style guidelines.

IMPORTANT: Focus entirely on detailed visual descriptions with professional quality elements. Do not include any text overlays or voice-overs.

Format your response as a JSON array of scene objects with these properties:
- description: Detailed visual description for image generation with ${detectedStyle} style and professional quality standards
- duration: Scene duration in seconds

NOTE: Make sure the sum of all scene durations equals exactly ${totalDuration} seconds.
`;
};

/**
 * Fallback prompt for when the analysis prompt isn't available
 */
export const FALLBACK_STORYBOARD_PROMPT = (
  adType: string,
  productName: string,
  targetAudience: string,
  keyPoints: string,
  numScenes: number,
  totalDuration: number
) => `
Create a complete storyboard for a ${adType} advertisement for "${productName}" 
targeting ${targetAudience}.

Key points to highlight:
${keyPoints || "No specific points provided"}

The ad should have exactly ${numScenes} scenes.

PROFESSIONAL VISUAL QUALITY STANDARDS:
Sharp HD imagery, professional lighting, dynamic angles, high contrast, vibrant colors, commercial quality

IMPORTANT: The total duration must be exactly ${totalDuration} seconds, distributed appropriately across all ${numScenes} scenes.

For each scene, provide:
1. A detailed visual description that incorporates professional quality standards
2. Any text overlay or voice-over for the scene
3. Duration in seconds (between 1-10 seconds per scene)

Format your response as a JSON array of scene objects with these properties:
- description: Detailed visual description for image generation with professional quality standards
- text: Any text overlay or voice-over
- duration: Scene duration in seconds

NOTE: Make sure the sum of all scene durations equals exactly ${totalDuration} seconds.
`;

/**
 * Prompt for generating background images
 */
export const GENERATE_BACKGROUND_PROMPT = (prompt: string, style: string) => {
  const styleInstructions = getStyleInstructions(style);
  return `${prompt}. Style: ${styleInstructions}. Professional advertising quality, sharp focus, perfect lighting.`;
};

/**
 * Prompt for generating image assets
 */
export const GENERATE_ASSET_PROMPT = (prompt: string, style: string) => `
Create a visually appealing asset image based on this description:

${prompt}

Style: ${style}

The image should have a transparent background if possible.
Make it detailed and high-quality, suitable for inclusion in a professional advertisement.
`;

/**
 * Prompt for analyzing video content
 */
export const ANALYZE_VIDEO_CONTENT_PROMPT = (videoPrompt: string) => `
Analyze the following video concept and provide insights:

${videoPrompt}

Please provide:
1. Suggested themes and visual style
2. Key messaging points
3. Recommended scene structure
4. Target audience considerations
5. Suggested call to action
`;
