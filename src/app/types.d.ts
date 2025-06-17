declare global {
  interface Window {
    /**
     * Flag to prevent storage cleanup during export process
     */
    __EXPORT_IN_PROGRESS?: boolean;

    /**
     * Global state for editor scenes to be accessed by export modal
     */
    editorState?: {
      scenes: Array<{
        id: string;
        imageUrl?: string;
        duration: number;
        [key: string]: any;
      }>;
      projectId: string;
      projectName: string;
    };

    /**
     * Global function to sync editor state
     */
    __syncEditorState?: () => void;

    /**
     * React DevTools global hook for debugging
     */
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any;
  }
}

export {};
