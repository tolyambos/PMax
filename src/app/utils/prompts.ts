/**
 * This file contains all prompts used in the application.
 * Centralizing prompts makes it easier to edit and maintain them.
 */

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
) => `
Please analyze the following advertisement request and create a detailed concept:

- Product/Brand: ${productName}
- Ad Type: ${adType}
- Target Audience: ${targetAudience || "general audience"}
- Key Points to Highlight: ${keyPoints || "None specified"}
- Visual Style: ${style}
- Format: ${format}
- Number of Scenes: ${numScenes}
- Total Duration: ${totalDuration} seconds

Based on this information, especially the key points, create a cohesive and creative
ad narrative that incorporates all elements specified by the user.
`;

/**
 * Prompt for generating scene descriptions based on the analysis
 */
export const GENERATE_STORYBOARD_PROMPT = (
  analysisPrompt: string,
  numScenes: number,
  totalDuration: number
) => `
${analysisPrompt}

Generate a complete storyboard with exactly ${numScenes} scenes.
The total duration must be exactly ${totalDuration} seconds.

PROFESSIONAL VISUAL QUALITY STANDARDS:
Each scene description must incorporate professional photography and cinematography elements:
- Ultra sharp, crystal clear imagery with high definition detail
- Perfect professional lighting with dramatic effects and even exposure
- Dynamic camera angles and perspectives for maximum visual impact
- High contrast compositions that create visual interest and depth
- Vibrant, accurate colors with proper saturation and color grading
- Commercial advertising quality aesthetic and composition
- Clean, artifact-free environments without visual distortions
- Professional studio or cinematic environmental lighting
- Strong background contrast to enhance subject prominence
- Cinematic depth of field and focus techniques

For each scene, provide:
1. A detailed visual description that incorporates professional quality standards
2. Duration in seconds (between 1-5 seconds per scene)

Make your scene descriptions as vivid and specific as possible, incorporating all the key points
and elements mentioned in the description. Be creative and make sure the images will be 
visually compelling with rich, detailed descriptions that follow professional photography standards.

IMPORTANT: Focus entirely on detailed visual descriptions with professional quality elements. Do not include any text overlays or voice-overs.

Format your response as a JSON array of scene objects with these properties:
- description: Detailed visual description for image generation with professional quality standards
- duration: Scene duration in seconds

NOTE: Make sure the sum of all scene durations equals exactly ${totalDuration} seconds.
`;

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
Each scene description must incorporate professional photography and cinematography elements:
- Ultra sharp, crystal clear imagery with high definition detail
- Perfect professional lighting with dramatic effects and even exposure
- Dynamic camera angles and perspectives for maximum visual impact
- High contrast compositions that create visual interest and depth
- Vibrant, accurate colors with proper saturation and color grading
- Commercial advertising quality aesthetic and composition
- Clean, artifact-free environments without visual distortions
- Professional studio or cinematic environmental lighting
- Strong background contrast to enhance subject prominence
- Cinematic depth of field and focus techniques

IMPORTANT: The total duration must be exactly ${totalDuration} seconds, distributed appropriately across all ${numScenes} scenes.

For each scene, provide:
1. A detailed visual description that incorporates professional quality standards
2. Any text overlay or voice-over for the scene
3. Duration in seconds (between 1-5 seconds per scene)

Format your response as a JSON array of scene objects with these properties:
- description: Detailed visual description for image generation with professional quality standards
- text: Any text overlay or voice-over
- duration: Scene duration in seconds

NOTE: Make sure the sum of all scene durations equals exactly ${totalDuration} seconds.
`;

/**
 * Prompt for generating background images
 */
export const GENERATE_BACKGROUND_PROMPT = (prompt: string, style: string) => `
Create a high-quality, visually appealing background image based on this description:

${prompt}

Style: ${style}

PROFESSIONAL QUALITY REQUIREMENTS:
- Ultra sharp, crystal clear, high definition imagery
- Perfect professional lighting with even exposure
- Vibrant, accurate colors with proper saturation
- Clean composition without visual artifacts or distortions
- Photorealistic detail with correct proportions
- Commercial advertising quality and aesthetic appeal
- Dynamic angles and perspectives for visual interest
- High contrast and depth for improved visual impact
- Professional photography standard suitable for advertising

The image should be beautiful, professional, and eye-catching.
Make sure the background works well with text overlays and product placement.
Ensure professional lighting conditions and avoid any blurry, pixelated, or distorted elements.
`;

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
