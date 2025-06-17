"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { useEditor } from "../context/editor-context";
import { useAssetManagement } from "../hooks/use-asset-management";
import { useElementUpdates } from "../hooks/use-element-updates"; // Import the new hook
import { useVideoFormat } from "@/app/contexts/format-context";
import { ElementToolbar } from "../element-toolbar";
import { Asset, Element } from "../types";
import AssetLibrary from "@/app/components/assets/asset-library";
import EnhancedUploadButton from "@/app/components/assets/enhanced-upload-button";
import AIPromptModal from "../ai-prompt-modal";
import {
  PlusCircle,
  Image as ImageIcon,
  Music,
  Mic,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  Trash,
  Globe,
  Layers,
  LayoutGrid,
  Type,
  Square,
  ShoppingBag,
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Separator } from "@/app/components/ui/separator";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  generateElementId,
  createElementContent,
} from "@/app/utils/element-utils";

// Element list rendering component with element selection sync
function ElementsList({
  scene,
  selectedElementId,
  onElementSelect,
  onDuplicateElement,
  onDeleteElement,
  isElementGlobal,
  handleMakeElementGlobal,
  onUpdateElement, // Make sure this prop is passed correctly
}: {
  scene: any;
  selectedElementId: string | null;
  onElementSelect: (elementId: string | null) => void;
  onDuplicateElement: (element: any) => void;
  onDeleteElement: (sceneId: string, elementId: string) => void;
  isElementGlobal: (elementId: string) => boolean;
  handleMakeElementGlobal: (element: any) => void;
  onUpdateElement: (sceneId: string, elementId: string, updates: any) => void;
}) {
  // Refs for element list items
  const elementRefs = useRef(new Map());

  // Effect to scroll to selected element
  useEffect(() => {
    if (selectedElementId && elementRefs.current.has(selectedElementId)) {
      const element = elementRefs.current.get(selectedElementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedElementId]);

  if (!scene || !scene.elements || scene.elements.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center p-6 space-y-4 text-sm rounded-md border text-muted-foreground">
        <div className="text-center">
          No elements in this scene. Create elements using the tools above.
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 space-y-2 element-list">
      {scene.elements.map((element: any) => (
        <div
          key={element.id}
          className="space-y-1"
          ref={(el) => {
            if (el) elementRefs.current.set(element.id, el);
            else elementRefs.current.delete(element.id);
          }}
        >
          <div
            className={`border rounded-md overflow-hidden transition-colors p-3 cursor-pointer ${
              selectedElementId === element.id
                ? "border-primary bg-accent/30"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
            }`}
            onClick={() => onElementSelect(element.id)}
            data-element-id={element.id}
            data-selected={selectedElementId === element.id ? "true" : "false"}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-2 items-center">
                {/* Icon based on element type */}
                {element.type === "image" && (
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                )}
                {element.type === "text" && (
                  <span className="text-lg font-bold text-green-500">T</span>
                )}
                {element.type === "shape" && (
                  <Layers className="w-4 h-4 text-purple-500" />
                )}
                {element.type === "cta" && (
                  <Button className="w-4 h-4 p-0 text-[8px]" size="sm">
                    Button
                  </Button>
                )}
                {element.type === "video" && (
                  <span className="text-red-500">►</span>
                )}
                {element.type === "audio" && (
                  <Music className="w-4 h-4 text-yellow-500" />
                )}

                <span className="font-medium text-sm truncate max-w-[140px]">
                  {element.type.charAt(0).toUpperCase() + element.type.slice(1)}
                  {element.type === "text" &&
                    element.content &&
                    `: ${
                      typeof element.content === "string" &&
                      element.content.startsWith("{")
                        ? JSON.parse(element.content).text?.substring(0, 10) ||
                          ""
                        : (element.content as string)?.substring(0, 10) || ""
                    }${(typeof element.content === "string" ? element.content : "").length > 10 ? "..." : ""}`}
                </span>

                {isElementGlobal(element.id) && (
                  <Globe className="w-3 h-3 text-indigo-500" />
                )}
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 w-6 h-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateElement(element);
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 w-6 h-6 hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteElement(scene.id, element.id);
                  }}
                >
                  <Trash className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Element Settings - Only show for selected element */}
          {selectedElementId === element.id && (
            <div
              className="p-3 mt-1 rounded-md border bg-card"
              data-element-id={`${element.id}-settings`}
            >
              <ElementToolbar
                onAddElement={() => {}}
                sceneId={scene.id}
                selectedElement={element}
                onUpdateElement={(elementId: string, updates: any) =>
                  onUpdateElement(scene.id, elementId, updates)
                }
                onMakeElementGlobal={() => handleMakeElementGlobal(element)}
              />

              {/* Global Element Toggle */}
              <div className="flex justify-between items-center pt-3 mt-3 border-t">
                <span className="text-sm">Sync across all scenes</span>
                <Button
                  variant={isElementGlobal(element.id) ? "default" : "outline"}
                  size="sm"
                  className={`h-8 ${isElementGlobal(element.id) ? "bg-indigo-600" : ""}`}
                  onClick={() => handleMakeElementGlobal(element)}
                >
                  <Globe
                    className={`mr-1 w-4 h-4 ${isElementGlobal(element.id) ? "text-white" : ""}`}
                  />
                  {isElementGlobal(element.id) ? "Global" : "Make Global"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ElementsPanel({
  toast,
  scenes,
  selectedScene,
  selectedSceneId,
  selectedElementId,
  onAddScenes,
  onDeleteElement,
  onResizeElement,
  onMoveElement,
  onRotateElement,
  onUpdateElement: propsUpdateElement, // Rename to avoid confusion
  onElementSelect,
  onSetGlobalElement,
  globalElements,
  onMakeElementGlobal,
}: any) {
  const { state, dispatch } = useEditor();
  const { currentFormat, formatDetails } = useVideoFormat();
  const {
    assets,
    generatedAssets,
    handleGeneratedAsset,
    addAssetToScene,
    uploadAssets,
    searchAssets,
  } = useAssetManagement();

  // Use the new hook for real-time updates
  const { handleUpdateElement: hookUpdateElement } = useElementUpdates();

  const [activeTab, setActiveTab] = useState<"elements" | "assets">("elements");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPromptType, setAIPromptType] = useState<
    "asset" | "voiceover" | "music"
  >("asset");
  const [forCurrentScene, setForCurrentScene] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [updateCount, setUpdateCount] = useState(0); // Force re-renders on updates

  // Add an effect to watch for element selection changes in the state
  useEffect(() => {
    console.log("Element selection changed:", state.selectedElementId);

    // Force a re-render when selection changes
    setUpdateCount((prev) => prev + 1);
  }, [state.selectedElementId]);

  // Effect to force-scroll to the selected element when it changes
  useEffect(() => {
    if (state.selectedElementId) {
      // Find the element in the DOM
      setTimeout(() => {
        const selectedElement = document.querySelector(
          `.element-list [data-element-id="${state.selectedElementId}"]`
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }, 100); // Short delay to ensure DOM is updated
    }
  }, [state.selectedElementId]);

  // Get the selected scene from context
  const selectedSceneFromContext = state.selectedSceneId
    ? state.scenes.find((scene) => scene.id === state.selectedSceneId)
    : null;

  // Use the directly provided scene, fallback to context
  const selectedSceneToUse = selectedScene || selectedSceneFromContext;

  // Get the selected element
  const selectedElementFromContext =
    selectedSceneToUse && state.selectedElementId
      ? selectedSceneToUse.elements.find(
          (element: Element) => element.id === state.selectedElementId
        )
      : null;
  const selectedElementToUse = selectedElementFromContext;

  // Combined update handler that uses both options
  const handleUpdateElement = useCallback(
    (sceneId: string, elementId: string, updates: any) => {
      console.log("Element update requested:", { elementId, updates });

      // Use the hook implementation for immediate UI updates
      hookUpdateElement(sceneId, elementId, updates);

      // Also use the prop implementation if available (for persistence)
      if (propsUpdateElement) {
        propsUpdateElement(sceneId, elementId, updates);
      }

      // Force a re-render of this component
      setUpdateCount((prev) => prev + 1);
    },
    [hookUpdateElement, propsUpdateElement]
  );

  // Function to open AI generation modal
  const handleOpenAIPrompt = (
    type: "asset" | "voiceover" | "music",
    forScene = false
  ) => {
    setAIPromptType(type);
    setForCurrentScene(forScene);
    setIsAIModalOpen(true);
  };

  // Function to handle AI generation results
  const handleAIGenerate = (result: any) => {
    if (!result) return;

    if (aiPromptType === "asset") {
      // Handle generated image asset
      handleGeneratedAsset(result, forCurrentScene);

      if (forCurrentScene && state.selectedSceneId) {
        toast({
          title: "Asset Added to Scene",
          description: "Generated asset has been added to the current scene.",
        });
      } else {
        toast({
          title: "Asset Generated",
          description: "Asset has been added to your library.",
        });
      }
    } else if (aiPromptType === "voiceover") {
      // Handle voiceover generation
      handleGeneratedAsset(result, forCurrentScene);

      toast({
        title: "Voiceover Generated",
        description: "Voiceover has been added to your assets library.",
      });
    } else if (aiPromptType === "music") {
      // Handle music generation
      handleGeneratedAsset(result, forCurrentScene);

      toast({
        title: "Music Generated",
        description: "Music track has been added to your assets library.",
      });
    }
  };

  // Helper function to get format-appropriate element positions and sizes
  const getFormatAwareElementConfig = (elementType: string) => {
    const isVertical = currentFormat === "9:16";
    const isHorizontal = currentFormat === "16:9";
    const isSquare = currentFormat === "1:1";
    const isPortrait = currentFormat === "4:5";

    // Base configurations for different element types
    const configs = {
      text: {
        // Vertical format: place near top-left
        "9:16": { x: 10, y: 10, width: 80, height: 20 },
        // Horizontal format: place in center-left area
        "16:9": { x: 10, y: 35, width: 60, height: 15 },
        // Square format: balanced positioning
        "1:1": { x: 15, y: 15, width: 70, height: 18 },
        // Portrait format: similar to vertical but adjusted
        "4:5": { x: 12, y: 12, width: 76, height: 18 },
      },
      shape: {
        // Vertical format: slightly offset from text
        "9:16": { x: 20, y: 40, width: 40, height: 40 },
        // Horizontal format: center-right area
        "16:9": { x: 50, y: 30, width: 30, height: 30 },
        // Square format: center positioning
        "1:1": { x: 30, y: 30, width: 40, height: 40 },
        // Portrait format: balanced
        "4:5": { x: 25, y: 35, width: 35, height: 35 },
      },
      cta: {
        // Vertical format: bottom area
        "9:16": { x: 10, y: 70, width: 80, height: 15 },
        // Horizontal format: bottom-center
        "16:9": { x: 25, y: 65, width: 50, height: 20 },
        // Square format: bottom positioning
        "1:1": { x: 20, y: 70, width: 60, height: 18 },
        // Portrait format: bottom area
        "4:5": { x: 15, y: 75, width: 70, height: 16 },
      },
      logo: {
        // Vertical format: top-right corner
        "9:16": { x: 70, y: 5, width: 25, height: 25 },
        // Horizontal format: top-right corner
        "16:9": { x: 80, y: 10, width: 15, height: 15 },
        // Square format: top-right
        "1:1": { x: 75, y: 8, width: 20, height: 20 },
        // Portrait format: top-right
        "4:5": { x: 72, y: 6, width: 23, height: 23 },
      },
    };

    return (
      configs[elementType as keyof typeof configs]?.[
        currentFormat as keyof (typeof configs)[keyof typeof configs]
      ] ||
      configs[elementType as keyof typeof configs]?.["9:16"] || {
        x: 10,
        y: 10,
        width: 50,
        height: 20,
      }
    );
  };

  // Helper function to get format-appropriate font sizes
  const getFormatAwareFontSize = (baseSize: string, elementType: string) => {
    const baseSizeNum = parseInt(baseSize);

    // Font size multipliers for different formats
    const multipliers = {
      "9:16": 1.0, // Base size for vertical
      "16:9": 0.85, // Smaller for horizontal to fit better
      "1:1": 0.9, // Slightly smaller for square
      "4:5": 0.95, // Close to vertical
    };

    const multiplier = multipliers[currentFormat] || 1.0;
    return `${Math.round(baseSizeNum * multiplier)}px`;
  };

  // Function to add a new element to the current scene AND select it for editing
  const handleAddElement = (elementConfig: any) => {
    if (!state.selectedSceneId) {
      toast({
        title: "No scene selected",
        description: "Please select a scene to add elements to",
        variant: "destructive",
      });
      return;
    }

    // Generate unique ID for element
    const elementId = generateElementId();

    // Process the config to ensure proper values
    const processedConfig = {
      ...elementConfig,
      id: elementId,
      x: Math.round(Number(elementConfig.x || 0)),
      y: Math.round(Number(elementConfig.y || 0)),
      width: elementConfig.width
        ? Math.round(Number(elementConfig.width))
        : undefined,
      height: elementConfig.height
        ? Math.round(Number(elementConfig.height))
        : undefined,
      rotation: Math.round(Number(elementConfig.rotation || 0)),
      zIndex: Math.round(Number(elementConfig.zIndex || 0)),
    };

    // Add the element to the scene
    dispatch({
      type: "ADD_ELEMENT",
      payload: {
        sceneId: state.selectedSceneId,
        element: processedConfig,
      },
    });

    // Save the element directly to the database to ensure it persists
    saveElementDirectly(processedConfig, state.selectedSceneId);

    // Select the newly added element for immediate editing
    dispatch({ type: "SELECT_ELEMENT", payload: elementId });

    toast({
      title: "Element added",
      description: `Added a new ${elementConfig.type} element.`,
    });
  };

  // Function to save an element directly to the database
  const saveElementDirectly = async (element: any, sceneId: string) => {
    try {
      console.log("Saving element directly to database:", {
        elementId: element.id,
        sceneId,
        type: element.type,
      });

      const response = await fetch("/api/elements/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...element,
          sceneId: sceneId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Element saved successfully to database:", data.element);
      } else {
        console.error("Failed to save element directly:", data.error);
      }
    } catch (error) {
      console.error("Error saving element directly to database:", error);
    }
  };

  // Function to delete an element
  const handleDeleteElement = (sceneId: string, elementId: string) => {
    dispatch({
      type: "DELETE_ELEMENT",
      payload: { sceneId, elementId },
    });

    toast({
      title: "Element Deleted",
      description: "The element has been removed from the scene",
    });
  };

  // Function to duplicate an element
  const handleDuplicateElement = (element: Element) => {
    if (!state.selectedSceneId) return;

    // Create a copy with new ID and slightly offset position
    const duplicatedElement = {
      ...element,
      id: generateElementId(),
      x: element.x + 5,
      y: element.y + 5,
    };

    // Add the duplicated element to the scene
    dispatch({
      type: "ADD_ELEMENT",
      payload: {
        sceneId: state.selectedSceneId,
        element: duplicatedElement,
      },
    });

    // Select the newly duplicated element
    dispatch({ type: "SELECT_ELEMENT", payload: duplicatedElement.id });

    toast({
      title: "Element Duplicated",
      description: "Created a copy of the selected element",
    });
  };

  // Function to check if an element is global
  const isElementGlobal = (elementId: string): boolean => {
    if (!globalElements) return false;

    // Handle both Set and Array types
    if (globalElements instanceof Set) {
      return globalElements.has(elementId);
    } else if (Array.isArray(globalElements)) {
      return globalElements.some((elem) => elem.id === elementId);
    }

    return false;
  };

  // Function to make an element global
  const handleMakeElementGlobal = (element: Element) => {
    if (!state.selectedSceneId) return;

    // Check if the element is already global
    const isElementGlobalResult = isElementGlobal(element.id);

    // Toggle global status
    dispatch({
      type: "SET_GLOBAL_ELEMENT",
      payload: { elementId: element.id, isGlobal: !isElementGlobalResult },
    });

    if (isElementGlobalResult) {
      toast({
        title: "Element Is No Longer Global",
        description:
          "The element will not be synchronized across scenes anymore",
      });
    } else {
      // Add the element to all other scenes
      const elementsToAdd = state.scenes
        .filter((scene) => scene.id !== state.selectedSceneId)
        .map((scene) => {
          // Create a copy of the element for each scene
          return {
            sceneId: scene.id,
            element: {
              ...element,
              id: `${element.id}-${scene.id}-${Date.now()}`,
            },
          };
        });

      // Add copies to other scenes
      elementsToAdd.forEach(({ sceneId, element }) => {
        dispatch({
          type: "ADD_ELEMENT",
          payload: { sceneId, element },
        });
      });

      toast({
        title: "Element Made Global",
        description: `Element has been added to all ${state.scenes.length} scenes`,
      });
    }
  };

  // Handle element selection - use direct dispatch to ensure sync between canvas and panel
  const handleElementSelection = (elementId: string | null) => {
    // This is the critical function that needs to be synchronized
    console.log("Selecting element from panel:", elementId);
    dispatch({ type: "SELECT_ELEMENT", payload: elementId });
  };

  // Assets list rendering
  const renderAssetsList = () => {
    // Filter assets based on search query
    const filteredAssets = searchQuery
      ? searchAssets(searchQuery)
      : [...generatedAssets, ...assets];

    return (
      <>
        <div className="relative mb-3">
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1.5 h-6 w-6 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Clear</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAIPrompt("asset", true)}
            className="text-xs"
          >
            <PlusCircle className="mr-1 w-3 h-3" />
            Generate Image
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAIPrompt("music")}
            className="text-xs"
          >
            <Music className="mr-1 w-3 h-3" />
            Generate Music
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAIPrompt("voiceover")}
            className="text-xs"
          >
            <Mic className="mr-1 w-3 h-3" />
            Generate Voice
          </Button>
        </div>

        <div className="flex justify-between items-center mb-2">
          <div className="text-xs font-medium">Asset Library</div>
          <EnhancedUploadButton variant="outline" size="sm" />
        </div>

        <div className="h-[calc(100vh-400px)] border rounded-md overflow-hidden">
          <AssetLibrary
            onAssetSelect={(asset: any, createNewScene = false) => {
              if (createNewScene) {
                // Handle creating a new scene with this asset
                // (Implement with your scene creation logic)
                toast({
                  title: "Create Scene Not Implemented",
                  description:
                    "This functionality would create a new scene with the selected asset",
                });
                return;
              }

              if (!state.selectedSceneId) {
                toast({
                  variant: "destructive",
                  title: "No scene selected",
                  description: "Please select a scene before adding assets",
                });
                return;
              }

              // Add asset to selected scene
              addAssetToScene(asset as Asset, state.selectedSceneId);
            }}
          />
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4 h-full">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="elements">Canvas Items</TabsTrigger>
          <TabsTrigger value="assets">Media Library</TabsTrigger>
        </TabsList>

        <TabsContent
          value="elements"
          className="pt-2 h-[calc(100vh-180px)] overflow-y-auto"
        >
          <div className="space-y-4">
            {/* Simple Element Creation Section */}
            <div className="p-4 rounded-md border bg-card">
              <h3 className="mb-3 text-base font-medium">Add New Item</h3>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col items-center p-2 h-auto"
                  onClick={() => {
                    const config = getFormatAwareElementConfig("text");
                    handleAddElement({
                      type: "text",
                      content: createElementContent("Add your text here", {
                        color: "#FFFFFF",
                        fontSize: getFormatAwareFontSize("48px", "text"),
                        fontWeight: "400",
                        fontFamily: "Roboto",
                      }),
                      ...config,
                      rotation: 0,
                      opacity: 1,
                      zIndex: 10,
                    });
                  }}
                >
                  <Type className="mb-1 w-6 h-6" />
                  <span>Text</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center p-2 h-auto"
                  onClick={() => {
                    const config = getFormatAwareElementConfig("shape");
                    handleAddElement({
                      type: "shape",
                      content: createElementContent(
                        "",
                        { backgroundColor: "#3B82F6", opacity: 0.8 },
                        { shapeType: "rectangle" }
                      ),
                      ...config,
                      rotation: 0,
                      opacity: 0.8,
                      zIndex: 5,
                    });
                  }}
                >
                  <Square className="mb-1 w-6 h-6" />
                  <span>Shape</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center p-2 h-auto"
                  onClick={() => {
                    const config = getFormatAwareElementConfig("cta");
                    handleAddElement({
                      type: "cta",
                      content: createElementContent(
                        "Shop Now",
                        {
                          backgroundColor: "#10B981",
                          color: "#FFFFFF",
                          fontSize: getFormatAwareFontSize("36px", "cta"),
                          fontFamily: "Roboto",
                          fontWeight: "700",
                        },
                        { ctaType: "button" }
                      ),
                      ...config,
                      rotation: 0,
                      opacity: 1,
                      zIndex: 20,
                    });
                  }}
                >
                  <ShoppingBag className="mb-1 w-6 h-6" />
                  <span>CTA</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center p-2 h-auto"
                  onClick={() => {
                    setIsAIModalOpen(true);
                    setAIPromptType("asset");
                    setForCurrentScene(true);
                  }}
                >
                  <ImageIcon className="mb-1 w-6 h-6" />
                  <span>Image</span>
                </Button>
              </div>
            </div>

            {/* Elements List with Expandable Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Current Scene Items</h3>
              <ScrollArea className="h-[calc(100vh-300px)]">
                {/* Pass in our improved element list renderer with all required props */}
                <ElementsList
                  scene={selectedSceneToUse}
                  selectedElementId={state.selectedElementId} // Use state directly for proper sync
                  onElementSelect={handleElementSelection} // Use our improved handler
                  onDuplicateElement={handleDuplicateElement}
                  onDeleteElement={handleDeleteElement}
                  isElementGlobal={isElementGlobal}
                  handleMakeElementGlobal={handleMakeElementGlobal}
                  onUpdateElement={handleUpdateElement} // Pass our enhanced handler function
                />
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="assets"
          className="pt-2 h-[calc(100vh-180px)] overflow-y-auto"
        >
          {renderAssetsList()}
        </TabsContent>
      </Tabs>

      <AIPromptModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerate={handleAIGenerate}
        type={aiPromptType}
        forCurrentScene={forCurrentScene}
      />
    </div>
  );
}
