export const ANIMATION_TEMPLATES = [
  {
    id: "side-to-side-20",
    name: "Gentle Side-to-Side (20°)",
    prompt: "Stationary view, slow horizontal rotation from -20 to +20 degrees",
    description: "Smooth left-right rotation showing product",
  },
  {
    id: "side-to-side-30",
    name: "Medium Side-to-Side (30°)",
    prompt:
      "Static camera, simple side-to-side rotation of 30 degrees total, smooth and continuous",
    description: "Moderate rotation to showcase product sides",
  },
  {
    id: "pendulum-25",
    name: "Pendulum Swing (25°)",
    prompt:
      "Fixed perspective, smooth pendulum rotation left to right, 25 degrees total",
    description: "Natural swinging motion like a pendulum",
  },
  {
    id: "gentle-orbit",
    name: "Gentle Orbit",
    prompt:
      "Camera slowly orbits around product, maintaining eye level, 45 degree arc",
    description: "Camera moves around product in partial circle",
  },
  {
    id: "vertical-tilt",
    name: "Vertical Tilt (15°)",
    prompt:
      "Fixed position, gentle vertical tilt from -15 to +15 degrees, showing top and bottom",
    description: "Tilts up and down to reveal product details",
  },
  {
    id: "zoom-in-slow",
    name: "Slow Zoom In",
    prompt:
      "Stationary camera, slow zoom from 100% to 120%, focusing on product center",
    description: "Gradual zoom to highlight product features",
  },
  {
    id: "floating-gentle",
    name: "Gentle Float",
    prompt:
      "Product gently floating up and down 5%, with subtle 10 degree rotation",
    description: "Soft floating motion with minimal rotation",
  },
  {
    id: "360-spin",
    name: "Full 360° Spin",
    prompt:
      "Fixed camera, product completes one full 360 degree rotation, steady speed",
    description: "Complete rotation to show all angles",
  },
  {
    id: "diagonal-pan",
    name: "Diagonal Pan",
    prompt:
      "Camera pans diagonally from bottom-left to top-right, keeping product centered",
    description: "Dynamic diagonal camera movement",
  },
  {
    id: "static-subtle",
    name: "Almost Static",
    prompt:
      "Minimal movement, only 5 degree wobble, product stays nearly still",
    description: "Very subtle movement for minimalist feel",
  },
];

export function getAnimationTemplate(id: string) {
  return ANIMATION_TEMPLATES.find((template) => template.id === id);
}

export function getAnimationPrompt(id: string): string {
  const template = getAnimationTemplate(id);
  return template?.prompt || ANIMATION_TEMPLATES[0].prompt;
}
