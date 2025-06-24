/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Scene, Element, Asset } from "../types";
import { useToast } from "@/app/components/ui/use-toast";

// Define action types
type EditorAction =
  | { type: "SET_SCENES"; payload: Scene[] }
  | { type: "ADD_SCENE"; payload: Scene }
  | { type: "ADD_SCENES"; payload: Scene[] }
  | { type: "DELETE_SCENE"; payload: string }
  | {
      type: "UPDATE_SCENE";
      payload: { sceneId: string; updates: Partial<Scene> };
    }
  | { type: "REORDER_SCENES"; payload: Scene[] }
  | { type: "SELECT_SCENE"; payload: string | null }
  | { type: "ADD_ELEMENT"; payload: { sceneId: string; element: Element } }
  | { type: "DELETE_ELEMENT"; payload: { sceneId: string; elementId: string } }
  | {
      type: "UPDATE_ELEMENT";
      payload: {
        sceneId: string;
        elementId: string;
        updates: Partial<Element>;
      };
    }
  | { type: "SELECT_ELEMENT"; payload: string | null }
  | {
      type: "SET_GLOBAL_ELEMENT";
      payload: { elementId: string; isGlobal: boolean };
    }
  | {
      type: "SYNC_GLOBAL_ELEMENT";
      payload: { elementId: string; updates: Partial<Element> };
    }
  | { type: "SAVE_PROJECT" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_LAST_SAVED"; payload: Date }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_UNSAVED_CHANGES"; payload: boolean };

// Define editor state
interface EditorState {
  scenes: Scene[];
  selectedSceneId: string | null;
  selectedElementId: string | null;
  globalElements: Set<string>;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  undoStack: EditorState[];
  redoStack: EditorState[];
}

// Define the type for the window.editorState object
type EditorStateWindowObject = {
  scenes: Scene[];
  selectedSceneId: string | null;
  selectedElementId: string | null;
  projectId: string;
  projectName: string;
};

// Create context with initial state
const initialState: EditorState = {
  scenes: [],
  selectedSceneId: null,
  selectedElementId: null,
  globalElements: new Set<string>(),
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,
  undoStack: [],
  redoStack: [],
};

// Define the type for the EditorContext
type EditorContextType = {
  state: {
    scenes: Scene[];
    selectedSceneId: string | null;
    selectedElementId: string | null;
    globalElements: Set<string>;
    isSaving: boolean;
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
    undoStack: EditorState[];
    redoStack: EditorState[];
  };
  dispatch: React.Dispatch<EditorAction>;
  syncToDatabase: () => Promise<EditorState | undefined>;
  getScenesWithSyncedGlobalElements: () => Scene[];
  handleAddElement: (sceneId: string, element: Element) => void;
  handleDeleteElement: (sceneId: string, elementId: string) => void;
  handleUpdateElement: (
    sceneId: string,
    elementId: string,
    updates: Partial<Element>
  ) => void;
  handleUpdateSceneDuration: (sceneId: string, duration: number) => void;
};

// Create the context
const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Create a reducer for handling complex state changes
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  let newState: EditorState;

  switch (action.type) {
    case "SET_SCENES": {
      // Deduplicate elements within each scene
      const deduplicatedScenes = action.payload.map((scene) => {
        const uniqueElements = new Map<string, Element>();

        // Keep only the first occurrence of each element ID
        scene.elements.forEach((element) => {
          if (!uniqueElements.has(element.id)) {
            uniqueElements.set(element.id, element);
          } else {
            console.warn(
              `Duplicate element ${element.id} found in scene ${scene.id}, keeping first occurrence`
            );
          }
        });

        return {
          ...scene,
          elements: Array.from(uniqueElements.values()),
        };
      });

      return {
        ...state,
        scenes: deduplicatedScenes,
        selectedSceneId:
          deduplicatedScenes.length > 0 ? deduplicatedScenes[0].id : null,
      };
    }

    case "ADD_SCENE":
      return {
        ...state,
        scenes: [...state.scenes, action.payload],
        selectedSceneId: action.payload.id,
        hasUnsavedChanges: true,
      };

    case "ADD_SCENES":
      // Check if this is a "new scene" marker in the payload
      const isNewScene =
        action.payload.length === 1 && action.payload[0].isNewScene;

      if (isNewScene) {
        // Add the new scene to our existing scenes
        return {
          ...state,
          scenes: [...state.scenes, ...action.payload],
          selectedSceneId: action.payload[0].id,
          hasUnsavedChanges: true,
        };
      } else {
        // This is a complete scene update, replace all scenes
        return {
          ...state,
          scenes: action.payload,
          hasUnsavedChanges: true,
        };
      }

    case "DELETE_SCENE":
      // Find the index of the scene to delete
      const sceneIndex = state.scenes.findIndex(
        (scene) => scene.id === action.payload
      );
      if (sceneIndex === -1) return state;

      // Determine the next scene to select
      let nextSelectedSceneId: string | null = null;
      if (state.scenes.length > 1) {
        // Select the next scene, or the previous if it's the last one
        const nextIndex =
          sceneIndex < state.scenes.length - 1
            ? sceneIndex + 1
            : sceneIndex - 1;
        nextSelectedSceneId = state.scenes[nextIndex].id;
      }

      return {
        ...state,
        scenes: state.scenes.filter((scene) => scene.id !== action.payload),
        selectedSceneId: nextSelectedSceneId,
        hasUnsavedChanges: true,
        // Clear selected element if it was in the deleted scene
        selectedElementId:
          state.selectedElementId &&
          state.scenes[sceneIndex].elements.some(
            (el) => el.id === state.selectedElementId
          )
            ? null
            : state.selectedElementId,
      };

    case "UPDATE_SCENE":
      return {
        ...state,
        scenes: state.scenes.map((scene) =>
          scene.id === action.payload.sceneId
            ? { ...scene, ...action.payload.updates }
            : scene
        ),
        hasUnsavedChanges: true,
      };

    case "REORDER_SCENES":
      return {
        ...state,
        scenes: action.payload,
        hasUnsavedChanges: true,
      };

    case "SELECT_SCENE":
      return {
        ...state,
        selectedSceneId: action.payload,
        // Clear element selection when changing scenes
        selectedElementId: null,
      };

    case "ADD_ELEMENT": {
      const updatedScenes = state.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          // Check if element with this ID already exists
          const elementExists = scene.elements.some(
            (el) => el.id === action.payload.element.id
          );

          if (elementExists) {
            console.warn(
              `Element with ID ${action.payload.element.id} already exists in scene ${scene.id}`
            );
            return scene;
          }

          return {
            ...scene,
            elements: [...scene.elements, action.payload.element],
          };
        }
        return scene;
      });

      return {
        ...state,
        scenes: updatedScenes,
        selectedElementId: action.payload.element.id,
        hasUnsavedChanges: true,
      };
    }

    case "DELETE_ELEMENT": {
      const updatedScenes = state.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? {
              ...scene,
              elements: scene.elements.filter(
                (el) => el.id !== action.payload.elementId
              ),
            }
          : scene
      );

      // Also remove from global elements if present
      const updatedGlobalElements = new Set(state.globalElements);
      updatedGlobalElements.delete(action.payload.elementId);

      return {
        ...state,
        scenes: updatedScenes,
        globalElements: updatedGlobalElements,
        hasUnsavedChanges: true,
        selectedElementId:
          state.selectedElementId === action.payload.elementId
            ? null
            : state.selectedElementId,
      };
    }

    case "UPDATE_ELEMENT": {
      console.log(
        "🔧 Reducer: UPDATE_ELEMENT action received:",
        action.payload
      );

      const updatedScenes = state.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? {
              ...scene,
              elements: scene.elements.map((el) => {
                if (el.id === action.payload.elementId) {
                  const updatedElement = { ...el, ...action.payload.updates };
                  console.log(
                    "🎯 Reducer: Updating element from:",
                    el,
                    "to:",
                    updatedElement
                  );
                  return updatedElement;
                }
                return el;
              }),
            }
          : scene
      );

      console.log("✅ Reducer: State updated with new scenes");
      return {
        ...state,
        scenes: updatedScenes,
        hasUnsavedChanges: true,
      };
    }

    case "SELECT_ELEMENT":
      return {
        ...state,
        selectedElementId: action.payload,
      };

    case "SET_GLOBAL_ELEMENT": {
      const { elementId, isGlobal } = action.payload;
      const updatedGlobalElements = new Set(state.globalElements);

      if (isGlobal) {
        updatedGlobalElements.add(elementId);
      } else {
        updatedGlobalElements.delete(elementId);
      }

      return {
        ...state,
        globalElements: updatedGlobalElements,
        hasUnsavedChanges: true,
      };
    }

    case "SYNC_GLOBAL_ELEMENT": {
      // When a global element changes, sync those changes to all instances across scenes
      const { elementId, updates } = action.payload;

      // Only proceed if this is a global element
      if (!state.globalElements.has(elementId)) return state;

      // Find the base element ID (if it has a compound ID)
      const baseElementId = elementId.split("-")[0];

      // Update all related elements across all scenes
      const updatedScenes = state.scenes.map((scene) => {
        const updatedElements = scene.elements.map((element) => {
          // Check if this is a related global element
          const isRelatedElement =
            element.id === elementId ||
            element.id.startsWith(`${baseElementId}-`) ||
            elementId.startsWith(`${element.id}-`) ||
            baseElementId === element.id.split("-")[0];

          if (isRelatedElement) {
            return { ...element, ...updates };
          }
          return element;
        });

        return { ...scene, elements: updatedElements };
      });

      return {
        ...state,
        scenes: updatedScenes,
        hasUnsavedChanges: true,
      };
    }

    case "SAVE_PROJECT":
      return {
        ...state,
        isSaving: true,
      };

    case "UNDO":
      if (state.undoStack.length === 0) return state;

      // Pop the last state from the undo stack
      const prevState = state.undoStack[state.undoStack.length - 1];
      const newUndoStack = state.undoStack.slice(0, -1);

      // Push current state to redo stack
      return {
        ...prevState,
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, state],
      };

    case "REDO":
      if (state.redoStack.length === 0) return state;

      // Pop the last state from the redo stack
      const nextState = state.redoStack[state.redoStack.length - 1];
      const newRedoStack = state.redoStack.slice(0, -1);

      // Push current state to undo stack
      return {
        ...nextState,
        undoStack: [...state.undoStack, state],
        redoStack: newRedoStack,
      };

    case "SET_LAST_SAVED":
      return {
        ...state,
        lastSaved: action.payload,
        hasUnsavedChanges: false,
      };

    case "SET_SAVING":
      return {
        ...state,
        isSaving: action.payload,
      };

    case "SET_UNSAVED_CHANGES":
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };

    default:
      return state;
  }
}

// Function to properly format scenes for export
export function formatScenesForExport(scenes: Scene[]) {
  // Convert to proper format for export
  return scenes.map((scene) => {
    // Ensure we have the correct properties in the right format
    const exportScene = {
      id: scene.id,
      order: scene.order,
      duration:
        typeof scene.duration === "string"
          ? parseFloat(scene.duration)
          : scene.duration,
      imageUrl: scene.imageUrl || null,
      elements: scene.elements.map((element) => ({
        id: element.id,
        type: element.type,
        content: element.content,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation || 0,
        opacity: element.opacity || 1,
        zIndex: element.zIndex || 0,
        assetId: element.assetId,
        url: element.url,
      })),
      prompt: scene.prompt,
      videoUrl: scene.videoUrl,
      animationStatus: scene.animationStatus,
      animationPrompt: scene.animationPrompt,
      animate: scene.animate,
    };

    return exportScene;
  });
}

// Provider component
export function EditorProvider({
  children,
  projectId,
}: {
  children: ReactNode;
  projectId: string;
}) {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const { toast } = useToast();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Function to sync state with the database
  const syncToDatabase = async () => {
    if (!projectId) return;

    try {
      dispatch({ type: "SAVE_PROJECT" });

      // Reset unsaved changes flag
      setHasUnsavedChanges(false);

      // Save to local storage for demo/backup
      localStorage.setItem(
        `pmax_editor_data_${projectId}`,
        JSON.stringify({
          scenes: state.scenes,
          timestamp: new Date().toISOString(),
          projectInfo: { id: projectId },
          globalElements: Array.from(state.globalElements), // Save global elements to local storage
        })
      );

      // Prepare data for database format
      const databaseScenes = state.scenes.map((scene) => {
        let processedImageUrl = scene.imageUrl;

        // If it's an absolute URL with our domain, convert to relative URL for storage
        if (processedImageUrl && typeof processedImageUrl === "string") {
          const baseUrl =
            typeof window !== "undefined" ? window.location.origin : "";
          if (baseUrl && processedImageUrl.startsWith(baseUrl)) {
            processedImageUrl = processedImageUrl.substring(baseUrl.length);
          }
        }
        // Convert elements to database format
        const elements = scene.elements.map((element) => {
          // Check if this element is global
          const isGlobal = state.globalElements.has(element.id);

          // Parse existing content if it exists
          let contentObj;
          if (element.content) {
            try {
              if (typeof element.content === "string") {
                contentObj = JSON.parse(element.content);
              } else if (typeof element.content === "object") {
                contentObj = element.content;
              } else {
                contentObj = {
                  text:
                    typeof element.content === "string"
                      ? element.content
                      : String(element.content || ""),
                  style: {},
                };
              }
            } catch (e) {
              console.error(
                `Error parsing content for element ${element.id}:`,
                e
              );
              contentObj = {
                text:
                  typeof element.content === "string"
                    ? element.content
                    : String(element.content || ""),
                style: {},
              };
            }
          } else {
            contentObj = { text: "", style: {} };
          }

          // If style isn't present, add it
          if (!contentObj.style) {
            contentObj.style = {};
          }

          // CRITICAL: Explicitly preserve font properties if present
          if (element.style) {
            contentObj.style = {
              ...contentObj.style,
              ...element.style,
              // Explicitly preserve these key properties
              fontFamily:
                element.style.fontFamily || contentObj.style.fontFamily,
              fontWeight:
                element.style.fontWeight || contentObj.style.fontWeight,
              fontSize: element.style.fontSize || contentObj.style.fontSize,
            };
          }

          // Add isGlobal flag to content object
          contentObj.isGlobal = isGlobal;

          // Convert numeric values to integers for PostgreSQL
          // Handle element IDs - if it starts with 'element-', it's a new element
          // and we should let the database generate an ID
          return {
            id: element.id.startsWith("element-") ? undefined : element.id,
            type: element.type,
            content: JSON.stringify(contentObj), // Include isGlobal flag in content
            x: parseFloat(String(element.x || 0)),
            y: parseFloat(String(element.y || 0)),
            width:
              element.width !== undefined && element.width !== null
                ? parseFloat(String(element.width))
                : null,
            height:
              element.height !== undefined && element.height !== null
                ? parseFloat(String(element.height))
                : null,
            rotation: parseFloat(String(element.rotation || 0)),
            opacity: parseFloat(String(element.opacity || 1.0)),
            zIndex: parseInt(String(element.zIndex || 0), 10),
            assetId: element.assetId || null,
            url: element.url || "", // Use element.url
          };
        });

        // Return scene in database format
        return {
          id: scene.id,
          order: scene.order,
          duration: scene.duration,
          imageUrl: processedImageUrl || null,
          backgroundColor: scene.backgroundColor, // Support backgroundColor if present
          prompt: scene.prompt || undefined,
          videoUrl: scene.videoUrl || undefined,
          animationStatus: scene.animationStatus || undefined,
          animationPrompt: scene.animationPrompt || undefined,
          animate:
            scene.animate !== undefined
              ? scene.animate // Use database value if available
              : scene.animationStatus === "completed" ||
                scene.animationStatus === "processing" ||
                scene.animationStatus === "ready",
          useAnimatedVersion: scene.useAnimatedVersion || false,
          backgroundHistory: scene.backgroundHistory || [],
          animationHistory: scene.animationHistory || [],
          // Convert elements
          elements: elements,
        };
      });

      // Make API call to save to database
      const response = await fetch(`/api/editor/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          scenes: databaseScenes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Sync API error details:", errorData);
        throw new Error(`Failed to sync editor state: ${response.statusText}`);
      }

      // Update last saved timestamp
      const updatedState = {
        ...state,
        isSaving: false,
        lastSaved: new Date(),
      };

      return updatedState;
    } catch (error) {
      console.error("Error saving project:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Failed to save changes. Please try again.",
      });

      return {
        ...state,
        isSaving: false,
      };
    }
  };

  // Utility function to sync global elements across all scenes
  const syncGlobalElementsAcrossScenes = (
    scenes: Scene[],
    globalElements: Set<string>
  ) => {
    // First gather the latest version of each global element
    const latestGlobalElements = new Map<string, Element>();

    scenes.forEach((scene) => {
      scene.elements.forEach((element) => {
        if (globalElements.has(element.id)) {
          // Update our map with the latest version
          // If there's already an entry, only update if this one is newer
          const existing = latestGlobalElements.get(element.id);
          if (!existing) {
            latestGlobalElements.set(element.id, { ...element });
          }
        }
      });
    });

    // Now update all instances of global elements across all scenes
    const updatedScenes = scenes.map((scene) => {
      const updatedElements = scene.elements.map((element) => {
        if (globalElements.has(element.id)) {
          const latestVersion = latestGlobalElements.get(element.id);
          if (latestVersion) {
            // Preserve the original position and scene-specific properties
            return {
              ...latestVersion,
              id: element.id, // Keep original ID
              x: element.x, // Keep original position
              y: element.y,
              sceneId: scene.id,
            };
          }
        }
        return element;
      });

      return {
        ...scene,
        elements: updatedElements,
      };
    });

    return updatedScenes;
  };

  // Custom getter for accessing scenes that ensures global elements are always in sync
  const getScenesWithSyncedGlobalElements = () => {
    // Make sure global elements are synced across all scenes before returning
    return syncGlobalElementsAcrossScenes(state.scenes, state.globalElements);
  };

  // Initialize editor with project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        // First try to load from API
        const response = await fetch(`/api/projects/${projectId}`);

        if (response.ok) {
          const data = await response.json();
          console.log("Project data loaded from API:", data);

          // Log first scene elements for debugging
          if (data.scenes && data.scenes.length > 0) {
            console.log("First scene elements from API:", {
              sceneId: data.scenes[0].id,
              rawElements: data.scenes[0].elements,
              elementsCount: data.scenes[0].elements?.length || 0,
            });
          }

          // Initialize a set for global elements
          const globalElementIds = new Set<string>();

          // Convert database data structure to our internal format
          const convertedScenes = data.scenes.map((scene: any) => {
            // Debug log for elements processing
            console.log(`Processing scene ${scene.id}:`, {
              elementsInScene: scene.elements?.length || 0,
              elementsArray: scene.elements,
            });

            // Process elements for this scene with deduplication
            const seenElementIds = new Set<string>();
            const processedElements = (scene.elements || [])
              .filter((element: any) => {
                if (seenElementIds.has(element.id)) {
                  console.warn(
                    `Duplicate element ${element.id} found in scene ${scene.id} during loading, skipping`
                  );
                  return false;
                }
                seenElementIds.add(element.id);
                return true;
              })
              .map((element: any) => {
                // Debug each element conversion
                console.log(
                  `Converting element ${element.id} for scene ${scene.id}:`,
                  element
                );

                // Parse the content to check for isGlobal flag
                let parsedContent = element.content;
                let isGlobal = false;

                try {
                  if (element.content) {
                    const contentObj = JSON.parse(element.content);
                    // Extract isGlobal flag if it exists
                    if (contentObj && typeof contentObj === "object") {
                      isGlobal = !!contentObj.isGlobal;
                      // Keep the content but remove the isGlobal property from the displayed content
                      const { isGlobal: _, ...restContent } = contentObj;
                      parsedContent = JSON.stringify(restContent);
                    }
                  }
                } catch (error) {
                  console.error(
                    `Error parsing element content for ${element.id}:`,
                    error
                  );
                }

                // If this element is global, add its ID to the global elements set
                if (isGlobal) {
                  globalElementIds.add(element.id);
                }

                return {
                  id: element.id,
                  type: element.type,
                  content: parsedContent || undefined,
                  x: element.x,
                  y: element.y,
                  width: element.width || undefined,
                  height: element.height || undefined,
                  rotation: element.rotation,
                  opacity: element.opacity,
                  zIndex: element.zIndex,
                  assetId: element.assetId || undefined,
                  url: element.url || "", // Use element.url
                };
              });

            return {
              id: scene.id,
              order: scene.order,
              duration: scene.duration,
              imageUrl: scene.imageUrl || undefined,
              backgroundColor: undefined, // Add this field if your DB schema supports it
              prompt: scene.prompt || undefined,
              videoUrl: scene.videoUrl || undefined,
              animationStatus: scene.animationStatus || undefined,
              animationPrompt: scene.animationPrompt || undefined,
              animate:
                scene.animate !== undefined
                  ? scene.animate // Use database value if available
                  : scene.animationStatus === "completed" ||
                    scene.animationStatus === "processing" ||
                    scene.animationStatus === "ready",
              // Set useAnimatedVersion with intelligent defaults
              useAnimatedVersion: (() => {
                const dbValue = scene.useAnimatedVersion;
                const defaultValue =
                  scene.videoUrl && scene.animationStatus === "completed"
                    ? true
                    : false;
                const finalValue =
                  dbValue !== undefined ? dbValue : defaultValue;

                console.log(
                  `[EditorContext] Scene ${scene.id} useAnimatedVersion:`,
                  {
                    dbValue,
                    defaultValue,
                    finalValue,
                    hasVideo: !!scene.videoUrl,
                    animationStatus: scene.animationStatus,
                  }
                );

                return finalValue;
              })(),
              // Include history fields from the scene data
              backgroundHistory: scene.backgroundHistory || [],
              animationHistory: scene.animationHistory || [],
              // Set the processed elements
              elements: processedElements,
            };
          });

          console.log("Converted scenes with elements:", convertedScenes);
          console.log(
            "Restored global elements:",
            Array.from(globalElementIds)
          );

          // Set both the scenes and global elements
          const initializedState: EditorState = {
            ...initialState,
            scenes: convertedScenes,
            globalElements: globalElementIds,
          };

          // Use the reducer to set the state
          dispatch({
            type: "SET_SCENES",
            payload: convertedScenes,
          });

          // Set global elements one by one
          globalElementIds.forEach((elementId) => {
            dispatch({
              type: "SET_GLOBAL_ELEMENT",
              payload: { elementId, isGlobal: true },
            });
          });

          return;
        }

        // If API fails, try local storage
        const storedData = localStorage.getItem(
          `pmax_editor_data_${projectId}`
        );
        if (storedData) {
          const data = JSON.parse(storedData);
          if (data.scenes && Array.isArray(data.scenes)) {
            dispatch({ type: "SET_SCENES", payload: data.scenes });

            // If the local storage backup contains global elements, restore them
            if (data.globalElements && Array.isArray(data.globalElements)) {
              console.log(
                "Restoring global elements from local storage:",
                data.globalElements
              );

              // Set global elements one by one
              data.globalElements.forEach((elementId: string) => {
                dispatch({
                  type: "SET_GLOBAL_ELEMENT",
                  payload: { elementId, isGlobal: true },
                });
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading project:", error);
        toast({
          variant: "destructive",
          title: "Load failed",
          description: "Failed to load project data. Using default scenes.",
        });
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId, toast]);

  // Make window.editorState available for the export function to use
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Assign with a non-null assertion and type casting to ensure compatibility
      (window as any).editorState = {
        scenes: getScenesWithSyncedGlobalElements(),
        selectedSceneId: state.selectedSceneId,
        selectedElementId: state.selectedElementId,
        projectId: projectId || "", // Use empty string as fallback if projectId is undefined
        projectName: state.scenes.length > 0 ? "Video Project" : "",
      };

      // Add global sync function
      (window as any).__syncEditorState = syncToDatabase;
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).editorState;
        delete (window as any).__syncEditorState;
      }
    };
  }, [
    state.scenes,
    state.selectedSceneId,
    state.selectedElementId,
    state.globalElements,
    projectId,
    getScenesWithSyncedGlobalElements,
    syncToDatabase,
  ]);

  // A separate effect for updating window.editorState when state changes
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).editorState) {
      // Only update if editorState already exists
      (window as any).editorState = {
        scenes: getScenesWithSyncedGlobalElements(),
        selectedSceneId: state.selectedSceneId,
        selectedElementId: state.selectedElementId,
        projectId: projectId || "", // Use empty string as fallback if projectId is undefined
        projectName: state.scenes.length > 0 ? "Video Project" : "",
      };

      // Add global sync function
      (window as any).__syncEditorState = syncToDatabase;
    }
  }, [state, projectId, getScenesWithSyncedGlobalElements, syncToDatabase]);

  // Autosave changes every 5 seconds
  useEffect(() => {
    // Prevent rapid consecutive saves by using a debounced approach
    let pendingChanges = false;

    const autosaveInterval = setInterval(() => {
      if (state.isSaving) {
        pendingChanges = true;
        return;
      }

      if (pendingChanges || hasUnsavedChanges) {
        console.log("[EDITOR]: Running autosave due to pending changes");
        syncToDatabase();
        pendingChanges = false;
      }
    }, 5000);

    return () => clearInterval(autosaveInterval);
  }, [state.isSaving, syncToDatabase, hasUnsavedChanges]);

  // Watch for isSaving flag to trigger the actual database sync
  useEffect(() => {
    // When isSaving becomes true, trigger the actual database sync
    if (state.isSaving) {
      console.log("[EDITOR]: State marked for saving, running sync now");

      // Call the actual API
      const handleSyncDb = async () => {
        try {
          // Prepare data for database format
          const databaseScenes = state.scenes.map((scene) => {
            // Convert elements to database format
            const elements = scene.elements.map((element) => {
              // Check if this element is global
              const isGlobal = state.globalElements.has(element.id);

              // Parse existing content if it exists
              let contentObj;
              if (element.content) {
                try {
                  if (typeof element.content === "string") {
                    contentObj = JSON.parse(element.content);
                  } else if (typeof element.content === "object") {
                    contentObj = element.content;
                  } else {
                    contentObj = {
                      text:
                        typeof element.content === "string"
                          ? element.content
                          : String(element.content || ""),
                      style: {},
                    };
                  }
                } catch (error) {
                  console.error("Error parsing element content:", error);
                  contentObj = {
                    text:
                      typeof element.content === "string"
                        ? element.content
                        : String(element.content || ""),
                    style: {},
                  };
                }
              } else {
                contentObj = { text: "", style: {} };
              }

              // If style isn't present, add it
              if (!contentObj.style) {
                contentObj.style = {};
              }

              // CRITICAL: Explicitly preserve font properties if present
              if (element.style) {
                contentObj.style = {
                  ...contentObj.style,
                  ...element.style,
                  // Explicitly preserve these key properties
                  fontFamily:
                    element.style.fontFamily || contentObj.style.fontFamily,
                  fontWeight:
                    element.style.fontWeight || contentObj.style.fontWeight,
                  fontSize: element.style.fontSize || contentObj.style.fontSize,
                };
              }

              // Add isGlobal flag to content object
              contentObj.isGlobal = isGlobal;

              // Convert numeric values for PostgreSQL
              // Handle element IDs - if it starts with 'element-', it's a new element
              // and we should let the database generate an ID
              return {
                id: element.id.startsWith("element-") ? undefined : element.id,
                type: element.type,
                content: JSON.stringify(contentObj), // Include isGlobal flag in content
                x: parseFloat(String(element.x || 0)),
                y: parseFloat(String(element.y || 0)),
                width:
                  element.width !== undefined && element.width !== null
                    ? parseFloat(String(element.width))
                    : null,
                height:
                  element.height !== undefined && element.height !== null
                    ? parseFloat(String(element.height))
                    : null,
                rotation: parseFloat(String(element.rotation || 0)),
                opacity: parseFloat(String(element.opacity || 1.0)),
                zIndex: parseInt(String(element.zIndex || 0), 10),
                assetId: element.assetId || null,
                url: element.url || "", // Use element.url
              };
            });

            // Return scene in database format
            return {
              id: scene.id,
              order: scene.order,
              duration: scene.duration,
              imageUrl: scene.imageUrl || null,
              backgroundColor: scene.backgroundColor, // Support backgroundColor if present
              prompt: scene.prompt || undefined,
              videoUrl: scene.videoUrl || undefined,
              animationStatus: scene.animationStatus || undefined,
              animationPrompt: scene.animationPrompt || undefined,
              animate:
                scene.animate !== undefined
                  ? scene.animate // Use database value if available
                  : scene.animationStatus === "completed" ||
                    scene.animationStatus === "processing" ||
                    scene.animationStatus === "ready",
              // Convert elements
              elements: elements,
            };
          });

          // Make API call to save to database
          console.log(
            "[EDITOR]: Executing database sync with scenes:",
            databaseScenes.length
          );
          const response = await fetch(`/api/editor/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId,
              scenes: databaseScenes,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error("Sync API error details:", errorData);
            throw new Error(
              `Failed to sync editor state: ${response.statusText}`
            );
          }

          // Success! Update state to reflect saved status
          dispatch({ type: "SET_LAST_SAVED", payload: new Date() });
        } catch (error) {
          console.error("Error syncing to database:", error);
          toast({
            variant: "destructive",
            title: "Save failed",
            description: "Failed to save changes. Please try again.",
          });
        } finally {
          // Reset isSaving flag when done (success or failure)
          dispatch({ type: "SET_SAVING", payload: false });
        }
      };

      // Execute the sync
      handleSyncDb();
    }
  }, [state.isSaving, state.scenes, state.globalElements, projectId, toast]);

  // Watch for all state changes that should trigger the unsaved changes flag
  useEffect(() => {
    if (!state.isSaving && state.scenes.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [state.scenes, state.selectedElementId, state.globalElements]);

  // Add handler functions for editor actions that will set hasUnsavedChanges
  const handleAddElement = useCallback(
    (sceneId: string, element: Element) => {
      dispatch({ type: "ADD_ELEMENT", payload: { sceneId, element } });
      setHasUnsavedChanges(true);
    },
    [dispatch]
  );

  const handleDeleteElement = useCallback(
    (sceneId: string, elementId: string) => {
      dispatch({ type: "DELETE_ELEMENT", payload: { sceneId, elementId } });
      setHasUnsavedChanges(true);
    },
    [dispatch]
  );

  const handleUpdateElement = useCallback(
    (sceneId: string, elementId: string, updates: Partial<Element>) => {
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: { sceneId, elementId, updates },
      });
      setHasUnsavedChanges(true);
    },
    [dispatch]
  );

  const handleUpdateSceneDuration = useCallback(
    (sceneId: string, duration: number) => {
      dispatch({
        type: "UPDATE_SCENE",
        payload: {
          sceneId,
          updates: { duration },
        },
      });
      setHasUnsavedChanges(true);
    },
    [dispatch]
  );

  // Return provider with state and dispatch
  return (
    <EditorContext.Provider
      value={{
        state: {
          ...state,
          // Provide synced scenes when directly accessing state.scenes
          get scenes() {
            return getScenesWithSyncedGlobalElements();
          },
        },
        dispatch,
        syncToDatabase,
        getScenesWithSyncedGlobalElements,
        handleAddElement,
        handleDeleteElement,
        handleUpdateElement,
        handleUpdateSceneDuration,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

// Custom hook for using the editor context
export function useEditor(): EditorContextType {
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }

  return context;
}

// Note: Using the Window extension from types.d.ts instead
