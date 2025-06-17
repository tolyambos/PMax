// Utility for type checking scene types across the system

export type DBScene = {
  id: string;
  projectId: string;
  order: number;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  videoUrl: string | null;
  prompt: string | null;
  animationPrompt: string | null;
  animationStatus: string | null;
  elements: any[];
};

export type EditorScene = {
  id: string;
  order: number;
  duration: number;
  imageUrl?: string;
  backgroundColor?: string;
  prompt?: string;
  elements: any[];
  animate?: boolean;
  imagePrompt?: string;
  videoUrl?: string;
  animationStatus?: string;
  animationPrompt?: string;
};

export type APIScene = {
  id: string;
  projectId: string;
  order: number;
  duration: number;
  imageUrl: string;
  videoUrl: string;
  prompt: string;
  animationStatus: string;
  animationPrompt: string;
  createdAt: string;
  updatedAt: string;
  elements: any[];
};
