export interface ImageStylePreset {
  id: string;
  name: string;
  description: string;
  basePrompt: string;
  category: "product" | "lifestyle" | "abstract" | "tech" | "fashion" | "food";
}

export const imageStylePresets: ImageStylePreset[] = [
  // Product Photography Presets
  {
    id: "super-minimalist",
    name: "Super Minimalist",
    description: "Product only on solid color background, no elements",
    category: "product",
    basePrompt:
      "Product only, solid color background, no props, centered composition, even lighting, ultra clean",
  },
  {
    id: "minimalist-product",
    name: "Minimalist Product",
    description: "Clean, simple product shots with plenty of negative space",
    category: "product",
    basePrompt:
      "Minimalist product photo, white background, soft shadows, centered product, clean aesthetic",
  },
  {
    id: "luxury-product",
    name: "Luxury Premium",
    description: "High-end, sophisticated product presentation",
    category: "product",
    basePrompt:
      "Luxury product, dark background, dramatic lighting, premium materials, elegant composition",
  },
  {
    id: "floating-product",
    name: "Floating Product",
    description: "Products appearing to float or levitate",
    category: "product",
    basePrompt:
      "Floating product, mid-air suspension, clean background, soft shadows, modern presentation",
  },
  {
    id: "gradient-backdrop",
    name: "Gradient Backdrop",
    description: "Products on smooth gradient backgrounds",
    category: "product",
    basePrompt:
      "Product on gradient background, smooth color transition, modern aesthetic, vibrant colors",
  },

  // Lifestyle & Context Presets
  {
    id: "lifestyle-context",
    name: "Lifestyle Context",
    description: "Products shown in real-life settings",
    category: "lifestyle",
    basePrompt:
      "Product in lifestyle setting, natural environment, authentic context, natural lighting",
  },
  {
    id: "flat-lay",
    name: "Flat Lay Arrangement",
    description: "Top-down view with complementary items",
    category: "lifestyle",
    basePrompt:
      "Flat lay composition, top-down view, curated arrangement, complementary props, balanced layout",
  },
  {
    id: "hero-shot",
    name: "Epic Hero Shot",
    description: "Dramatic, impactful product presentation",
    category: "product",
    basePrompt:
      "Hero shot, dramatic lighting, low angle, cinematic style, high contrast, powerful presence",
  },

  // Tech & Modern Presets
  {
    id: "tech-futuristic",
    name: "Tech Futuristic",
    description: "High-tech, futuristic product presentation",
    category: "tech",
    basePrompt:
      "Tech product, futuristic style, neon accents, dark background, holographic elements",
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    description: "Products with vibrant neon lighting",
    category: "tech",
    basePrompt:
      "Neon glow product, vibrant colors, dark contrast, reflective surface, urban style",
  },

  // Abstract & Artistic Presets
  {
    id: "abstract-artistic",
    name: "Abstract Artistic",
    description: "Creative, artistic product presentation",
    category: "abstract",
    basePrompt:
      "Abstract product art, creative angles, experimental lighting, artistic composition",
  },
  {
    id: "geometric-modern",
    name: "Geometric Modern",
    description: "Products with geometric shapes and patterns",
    category: "abstract",
    basePrompt:
      "Geometric product shot, clean lines, modern shapes, precise composition, shadow patterns",
  },

  // Fashion & Beauty Presets
  {
    id: "fashion-editorial",
    name: "Fashion Editorial",
    description: "High-fashion editorial style product shots",
    category: "fashion",
    basePrompt:
      "Fashion editorial style, sophisticated presentation, luxury aesthetic, perfect lighting",
  },
  {
    id: "beauty-glamour",
    name: "Beauty Glamour",
    description: "Glamorous beauty product presentation",
    category: "fashion",
    basePrompt:
      "Beauty glamour shot, soft lighting, luxurious setting, elegant composition, glossy finish",
  },

  // Food & Beverage Presets
  {
    id: "food-appetizing",
    name: "Appetizing Food",
    description: "Mouth-watering food product photography",
    category: "food",
    basePrompt:
      "Food product shot, appetizing styling, warm lighting, fresh presentation",
  },
  {
    id: "beverage-refreshing",
    name: "Refreshing Beverage",
    description: "Crisp, refreshing drink photography",
    category: "food",
    basePrompt:
      "Beverage shot, condensation drops, ice cubes, backlit glass, refreshing look",
  },

  // Seasonal & Thematic Presets
  {
    id: "seasonal-holiday",
    name: "Seasonal Holiday",
    description: "Festive, seasonal product presentation",
    category: "lifestyle",
    basePrompt:
      "Holiday product shot, festive decorations, warm atmosphere, seasonal colors",
  },
  {
    id: "eco-natural",
    name: "Eco Natural",
    description: "Natural, sustainable product presentation",
    category: "lifestyle",
    basePrompt:
      "Eco product shot, natural materials, earth tones, organic elements, sustainable style",
  },
];

export function getPresetById(id: string): ImageStylePreset | undefined {
  return imageStylePresets.find((preset) => preset.id === id);
}

export function getPresetsByCategory(category: string): ImageStylePreset[] {
  return imageStylePresets.filter((preset) => preset.category === category);
}

export function combineStyleWithPreset(
  userStyle: string,
  presetId?: string
): string {
  if (!presetId) {
    // If no preset selected, enhance user style with quality modifiers
    return `${userStyle}, professional quality, sharp focus`;
  }

  const preset = getPresetById(presetId);
  if (!preset) {
    return userStyle;
  }

  // Combine preset base with user style for maximum control
  return `${preset.basePrompt}, ${userStyle}`;
}

export function enhancePromptWithStyle(
  basePrompt: string,
  userStyle: string,
  presetId?: string,
  productType?: string
): string {
  const styleEnhancement = combineStyleWithPreset(userStyle, presetId);

  // Add minimal product-specific enhancements
  let productEnhancements = "";
  if (productType) {
    const productLower = productType.toLowerCase();
    if (productLower.includes("tech") || productLower.includes("electronic")) {
      productEnhancements = ", tech aesthetic";
    } else if (
      productLower.includes("fashion") ||
      productLower.includes("clothing")
    ) {
      productEnhancements = ", fashion style";
    } else if (
      productLower.includes("food") ||
      productLower.includes("beverage")
    ) {
      productEnhancements = ", appetizing look";
    } else if (
      productLower.includes("beauty") ||
      productLower.includes("cosmetic")
    ) {
      productEnhancements = ", beauty presentation";
    }
  }

  // Keep final prompt concise
  return `${basePrompt}. Style: ${styleEnhancement}${productEnhancements}. Commercial quality.`;
}
