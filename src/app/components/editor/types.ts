// Type definitions for the editor components

export type Scene = {
  id: string;
  order: number;
  duration: number;
  imageUrl?: string;
  backgroundColor?: string;
  prompt?: string;
  elements: Element[];
  animate?: boolean;
  imagePrompt?: string;
  videoUrl?: string; // URL to animated version of the scene
  animationStatus?: string; // Status of animation (pending, processing, completed, failed)
  animationPrompt?: string; // Prompt used for animation generation
  isNewScene?: boolean; // Flag used when creating new scenes
  projectId?: string; // For database connection
  useAnimatedVersion?: boolean; // User's choice: true = use animation in export, false = use static
  backgroundHistory?: any[]; // History of background edits
  animationHistory?: any[]; // History of animations for this scene
};

export type Element = {
  id: string;
  type: "image" | "text" | "shape" | "cta" | "logo" | "video" | "audio";
  assetId?: string;
  url?: string;
  content?: any;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  style?: {
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
  ctaType?: "button" | "tag" | "banner";
  sceneId?: string; // For database connection
};

export type Asset = {
  id: string;
  name: string;
  type: "image" | "video" | "audio";
  url: string;
  thumbnail?: string;
  tags?: string[] | string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  createdAt?: string | Date;
  userId?: string;
};

export type ElementToolbarProps = {
  onAddElement?: (elementConfig: any) => void;
  sceneId: string;
  selectedElement?: Element;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onMakeElementGlobal?: (element: Element) => void;
};

export type AIPromptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (result: any) => void;
  type: "scene" | "voiceover" | "music" | "asset" | "background";
  forCurrentScene: boolean;
};
