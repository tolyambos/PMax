/**
 * This file contains all prompts used in the application.
 * Centralizing prompts makes it easier to edit and maintain them.
 */

/**
 * Get detailed style-specific instructions for image generation
 */
export function getStyleInstructions(style: string): string {
  const styleGuides: Record<string, string> = {
    cinematic: `
- Film-like quality with dramatic lighting and shadow play
- Professional cinematography techniques: depth of field, bokeh effects
- Moody atmosphere with carefully controlled color grading
- Dynamic camera angles: low angle shots, dutch angles, dramatic perspectives
- High contrast between light and dark areas (chiaroscuro lighting)
- Rich, saturated colors with cinematic color palettes (teal and orange, blue and amber)
- Atmospheric effects: lens flares, volumetric lighting, fog/haze for depth
- Wide aspect ratio framing with letterbox feel
- Epic scale and grandeur in composition
- Hollywood blockbuster production value`,

    realistic: `
- True-to-life photography with natural lighting conditions
- Authentic textures and materials with accurate surface properties
- Realistic shadows and reflections following physics
- Natural color temperature and white balance
- Documentary-style composition with candid feel
- Environmental lighting: golden hour, blue hour, overcast, direct sunlight
- Practical depth of field based on camera optics
- No artificial enhancements or stylization
- Photojournalistic quality with authentic moments
- Real-world proportions and perspective`,

    minimalist: `
- Clean, uncluttered composition with negative space
- Simple geometric shapes and forms
- Limited color palette: monochromatic or 2-3 colors maximum
- Flat lighting with soft shadows or no shadows
- Focus on essential elements only
- Scandinavian/Japanese aesthetic influence
- Plenty of white or neutral space
- Bold typography integration possibilities
- Strong emphasis on balance and symmetry
- Modern, sophisticated elegance`,

    vibrant: `
- Bold, saturated colors with high contrast
- Dynamic energy through color combinations
- Bright, punchy lighting with colorful highlights
- Pop art influence with graphic elements
- Neon accents and glowing effects
- Festival/carnival atmosphere possibilities
- Multiple light sources with color gels
- High key lighting for maximum brightness
- Playful, energetic composition
- Eye-catching visual impact with "wow" factor`,

    "3D rendered": `
- Photorealistic 3D graphics with ray-traced lighting
- Perfect surfaces with customizable materials
- Ambient occlusion for depth and realism
- Global illumination for accurate light bouncing
- Subsurface scattering for translucent materials
- Clean, artifact-free renders
- Studio lighting setup possibilities
- Infinite depth of field or selective focus
- Impossible camera angles and perspectives
- Futuristic or fantastical elements integration
`,
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

CRITICAL: Every scene MUST incorporate the ${detectedStyle} style requirements listed above. 
The style should be evident in lighting, composition, color grading, and overall aesthetic.

For each scene, provide:
1. A detailed visual description that incorporates BOTH the ${detectedStyle} style AND professional quality standards
2. Duration in seconds (between 1-5 seconds per scene)

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
export const GENERATE_BACKGROUND_PROMPT = (prompt: string, style: string) => {
  // Enhanced style-specific instructions
  const styleInstructions = getStyleInstructions(style);

  return `
Create a high-quality, visually appealing background image based on this description:

${prompt}

STYLE REQUIREMENTS - ${style.toUpperCase()}:
${styleInstructions}

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
