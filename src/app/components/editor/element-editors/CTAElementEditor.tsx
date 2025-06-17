"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import { ColorPicker } from "@/app/components/ui/color-picker";
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Square } from "lucide-react";

import { createElementContent } from "@/app/utils/element-utils";
import { Element } from "./../types";
import {
  getAllFontFamilies,
  getAvailableWeights,
  preloadFont,
} from "@/app/utils/fonts";

// Define CTA types
export type CTAType = "button" | "banner" | "tag";

interface CTAElementEditorProps {
  selectedElement?: Element;
  sceneId: string;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onAddElement?: (elementConfig: any) => void;
  isEditMode: boolean;
}

export default function CTAElementEditor({
  selectedElement,
  sceneId,
  onUpdateElement,
  onAddElement,
  isEditMode,
}: CTAElementEditorProps) {
  // CTA element state
  const [ctaType, setCtaType] = useState<CTAType>("button");
  const [ctaText, setCtaText] = useState<string>("Shop Now");
  const [ctaColor, setCtaColor] = useState<string>("#10B981");
  const [ctaTextColor, setCtaTextColor] = useState<string>("#FFFFFF");
  const [ctaFontFamily, setCtaFontFamily] = useState<string>("Roboto");
  const [ctaFontWeight, setCtaFontWeight] = useState<string>("700");
  const [ctaFontSize, setCtaFontSize] = useState<number>(36);

  // Border settings
  const [showBorderSettings, setShowBorderSettings] = useState<boolean>(false);
  const [ctaBorderWidth, setCtaBorderWidth] = useState<number>(2);
  const [ctaBorderColor, setCtaBorderColor] = useState<string>("#FFFFFF");

  // CTA size state
  const [ctaWidth, setCtaWidth] = useState<number>(80);
  const [ctaHeight, setCtaHeight] = useState<number>(15);

  // Font system state
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [availableWeights, setAvailableWeights] = useState<string[]>([
    "400",
    "700",
  ]);
  const [loadingFonts, setLoadingFonts] = useState(true);

  // Load all available font families when component mounts
  useEffect(() => {
    const loadFontFamilies = async () => {
      try {
        setLoadingFonts(true);
        const fonts = await getAllFontFamilies();
        setAvailableFonts(fonts);

        // Set a default font if the list is not empty and current font isn't available
        if (fonts.length > 0 && !fonts.includes(ctaFontFamily)) {
          setCtaFontFamily(fonts[0]);
        }

        setLoadingFonts(false);
      } catch (error) {
        console.error("Error loading font families:", error);
        setLoadingFonts(false);
      }
    };

    loadFontFamilies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load available weights when font family changes
  useEffect(() => {
    const loadFontWeights = async () => {
      try {
        // Preload the selected font to make it available immediately
        await preloadFont(ctaFontFamily);

        // Get available weights for the selected font
        const weights = await getAvailableWeights(ctaFontFamily);
        setAvailableWeights(weights);

        // Set a default weight if current weight is not available in this font
        if (!weights.includes(ctaFontWeight)) {
          const newWeight = weights.includes("700")
            ? "700"
            : weights.includes("400")
              ? "400"
              : weights[0];
          setCtaFontWeight(newWeight);

          // Update the element if in edit mode
          if (
            isEditMode &&
            selectedElement &&
            onUpdateElement &&
            selectedElement.type === "cta"
          ) {
            // Create base style with the new font weight
            const baseStyle = {
              backgroundColor: ctaColor,
              color: ctaTextColor,
              fontSize: ctaFontSize ? `${ctaFontSize}px` : "36px",
              fontFamily: ctaFontFamily,
              fontWeight: newWeight,
            };

            // Add border properties
            const styleWithBorder = {
              ...baseStyle,
              borderWidth: showBorderSettings ? `${ctaBorderWidth}px` : "0px",
              borderColor: ctaBorderColor,
              borderStyle: showBorderSettings ? "solid" : "none",
            };

            // Update the element with the new font weight
            onUpdateElement(sceneId, selectedElement.id, {
              content: createElementContent(ctaText, styleWithBorder, {
                ctaType,
              }),
            });
          }
        }
      } catch (error) {
        console.error(`Error loading weights for ${ctaFontFamily}:`, error);
      }
    };

    if (ctaFontFamily) {
      loadFontWeights();
    }
  }, [
    ctaFontFamily,
    ctaFontWeight,
    isEditMode,
    selectedElement,
    onUpdateElement,
    sceneId,
    ctaColor,
    ctaTextColor,
    ctaFontSize,
    showBorderSettings,
    ctaBorderWidth,
    ctaBorderColor,
    ctaText,
    ctaType,
  ]);

  // Initialize state from selected element if present
  useEffect(() => {
    if (selectedElement && selectedElement.type === "cta") {
      try {
        // Parse CTA content
        if (
          typeof selectedElement.content === "string" &&
          selectedElement.content.trim().startsWith("{")
        ) {
          const parsedContent = JSON.parse(selectedElement.content);
          setCtaText(parsedContent.text || "Shop Now");

          // Set CTA type if available
          if (parsedContent.ctaType) {
            setCtaType(parsedContent.ctaType as CTAType);
          }

          // Set style properties if available
          if (parsedContent.style) {
            // Background color
            if (parsedContent.style.backgroundColor) {
              setCtaColor(parsedContent.style.backgroundColor);
            }

            // Text color
            if (parsedContent.style.color) {
              setCtaTextColor(parsedContent.style.color);
            }

            // Font family
            if (parsedContent.style.fontFamily) {
              setCtaFontFamily(parsedContent.style.fontFamily);
            }

            // Font weight
            if (parsedContent.style.fontWeight) {
              setCtaFontWeight(parsedContent.style.fontWeight.toString());
            }

            // Font size
            if (parsedContent.style.fontSize) {
              const fontSizeValue = parseInt(
                parsedContent.style.fontSize.toString(),
                10
              );
              if (!isNaN(fontSizeValue)) {
                setCtaFontSize(fontSizeValue);
              }
            }

            // Border properties
            if (parsedContent.style.borderWidth) {
              const borderWidthValue = parseInt(
                parsedContent.style.borderWidth.toString(),
                10
              );
              if (!isNaN(borderWidthValue)) {
                setCtaBorderWidth(borderWidthValue);
                setShowBorderSettings(borderWidthValue > 0);
              }
            } else {
              setShowBorderSettings(false);
            }

            if (parsedContent.style.borderColor) {
              setCtaBorderColor(parsedContent.style.borderColor.toString());
            }
          }
        } else {
          setCtaText(selectedElement.content || "Shop Now");
        }

        // Set CTA size from element properties
        if (selectedElement.width) {
          try {
            const widthValue = parseFloat(selectedElement.width.toString());
            if (!isNaN(widthValue)) {
              setCtaWidth(widthValue);
            }
          } catch (error) {
            console.error("Error parsing CTA width:", error);
          }
        }

        if (selectedElement.height) {
          try {
            const heightValue = parseFloat(selectedElement.height.toString());
            if (!isNaN(heightValue)) {
              setCtaHeight(heightValue);
            }
          } catch (error) {
            console.error("Error parsing CTA height:", error);
          }
        }
      } catch (e) {
        console.error("Error parsing selected element content:", e);
      }
    }
  }, [selectedElement?.id]);

  // Add CTA element
  const handleAddCTA = () => {
    if (!onAddElement) return;

    // Create base style
    const baseStyle = {
      backgroundColor: ctaColor,
      color: ctaTextColor,
      fontSize: ctaFontSize ? `${ctaFontSize}px` : "36px",
      fontFamily: ctaFontFamily,
      fontWeight: ctaFontWeight,
    };

    // Add border properties
    const styleWithBorder = {
      ...baseStyle,
      borderWidth: showBorderSettings ? `${ctaBorderWidth}px` : "0px",
      borderColor: ctaBorderColor,
      borderStyle: showBorderSettings ? "solid" : "none",
    };

    onAddElement({
      type: "cta",
      content: createElementContent(
        ctaText,
        styleWithBorder,
        { ctaType } // Add ctaType as additional property
      ),
      x: Math.round(10), // Position near left
      y: Math.round(70), // Position near bottom
      width: Math.round(80), // Make it wider (percentage of canvas)
      height: Math.round(15), // Make it taller (percentage of canvas)
      rotation: 0, // Always keep rotation at 0 as we're not supporting it
      opacity: 1,
      zIndex: 20,
    });
  };

  // Create style object with border settings
  const createStyleWithBorder = (baseStyle: any) => {
    const styleObject = { ...baseStyle };

    // Add border properties if enabled
    if (showBorderSettings) {
      styleObject.borderWidth = `${ctaBorderWidth}px`;
      styleObject.borderColor = ctaBorderColor;
      styleObject.borderStyle = "solid";
    } else {
      styleObject.borderWidth = "0px";
      styleObject.borderColor = "transparent";
      styleObject.borderStyle = "none";
    }

    return styleObject;
  };

  // Update CTA element
  const handleUpdateCTA = (
    updates: Partial<{
      text: string;
      ctaType: CTAType;
      backgroundColor: string;
      textColor: string;
      fontSize: number;
      fontFamily: string;
      fontWeight: string;
      borderWidth: number;
      borderColor: string;
      showBorder: boolean;
    }> = {}
  ) => {
    if (!selectedElement || !onUpdateElement || selectedElement.type !== "cta")
      return;

    const updatedText = updates.text !== undefined ? updates.text : ctaText;
    const updatedType = updates.ctaType || ctaType;
    const updatedBgColor = updates.backgroundColor || ctaColor;
    const updatedTextColor = updates.textColor || ctaTextColor;
    const updatedFontSize = updates.fontSize || ctaFontSize;
    const updatedFontFamily = updates.fontFamily || ctaFontFamily;
    const updatedFontWeight = updates.fontWeight || ctaFontWeight;

    // Border settings
    const updatedShowBorder =
      updates.showBorder !== undefined
        ? updates.showBorder
        : showBorderSettings;
    const updatedBorderWidth = updates.borderWidth || ctaBorderWidth;
    const updatedBorderColor = updates.borderColor || ctaBorderColor;

    console.log("Updating CTA element with values:", {
      ctaType: updatedType,
      ctaText: updatedText,
      ctaColor: updatedBgColor,
      ctaTextColor: updatedTextColor,
      ctaFontSize: updatedFontSize,
      ctaFontFamily: updatedFontFamily,
      ctaFontWeight: updatedFontWeight,
      showBorder: updatedShowBorder,
      borderWidth: updatedBorderWidth,
      borderColor: updatedBorderColor,
    });

    // Create base style
    const baseStyle = {
      backgroundColor: updatedBgColor,
      color: updatedTextColor,
      fontSize: updatedFontSize ? `${updatedFontSize}px` : "36px",
      fontFamily: updatedFontFamily,
      fontWeight: updatedFontWeight,
    };

    // Add border properties
    const styleWithBorder = {
      ...baseStyle,
      borderWidth: updatedShowBorder ? `${updatedBorderWidth}px` : "0px",
      borderColor: updatedBorderColor,
      borderStyle: updatedShowBorder ? "solid" : "none",
    };

    onUpdateElement(sceneId, selectedElement.id, {
      content: createElementContent(updatedText, styleWithBorder, {
        ctaType: updatedType,
      }),
    });
  };

  // Add live preview for CTA text
  const handleCTATextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCtaText(newValue);

    // Update preview immediately but don't save to database yet
    if (selectedElement && selectedElement.type === "cta" && onUpdateElement) {
      // Create base style
      const baseStyle = {
        backgroundColor: ctaColor,
        color: ctaTextColor,
        fontSize: ctaFontSize ? `${ctaFontSize}px` : "36px",
        fontFamily: ctaFontFamily,
        fontWeight: ctaFontWeight,
      };

      // Add border properties
      const styleWithBorder = {
        ...baseStyle,
        borderWidth: showBorderSettings ? `${ctaBorderWidth}px` : "0px",
        borderColor: ctaBorderColor,
        borderStyle: showBorderSettings ? "solid" : "none",
      };

      // Use a special flag to indicate this is a preview update
      onUpdateElement(sceneId, selectedElement.id, {
        content: createElementContent(newValue, styleWithBorder, { ctaType }),
        _previewOnly: true,
      });
    }
  };

  // Handle border toggle
  const handleBorderToggle = (checked: boolean) => {
    setShowBorderSettings(checked);

    if (isEditMode) {
      handleUpdateCTA({ showBorder: checked });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Size</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Width (%)</Label>
            <Slider
              id="cta-width"
              min={5}
              max={100}
              step={1}
              value={[ctaWidth]}
              onValueChange={(value) => {
                const newWidth = value[0];
                setCtaWidth(newWidth);

                if (
                  selectedElement &&
                  onUpdateElement &&
                  selectedElement.type === "cta"
                ) {
                  // Calculate position adjustment to maintain center
                  const widthDiff = newWidth - ctaWidth;
                  const xAdjustment = widthDiff / 2;
                  const newX = Math.max(
                    0,
                    Math.min(100, selectedElement.x - xAdjustment)
                  );

                  // Update element width and position to maintain center
                  onUpdateElement(sceneId, selectedElement.id, {
                    width: newWidth,
                    x: newX,
                  });
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Height (%)</Label>
            <Slider
              id="cta-height"
              min={5}
              max={50}
              step={1}
              value={[ctaHeight]}
              onValueChange={(value) => {
                const newHeight = value[0];
                setCtaHeight(newHeight);

                if (
                  selectedElement &&
                  onUpdateElement &&
                  selectedElement.type === "cta"
                ) {
                  // Calculate position adjustment to maintain center
                  const heightDiff = newHeight - ctaHeight;
                  const yAdjustment = heightDiff / 2;
                  const newY = Math.max(
                    0,
                    Math.min(100, selectedElement.y - yAdjustment)
                  );

                  // Update element height and position to maintain center
                  onUpdateElement(sceneId, selectedElement.id, {
                    height: newHeight,
                    y: newY,
                  });
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>CTA Type</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={ctaType === "button" ? "default" : "outline"}
            onClick={() => {
              setCtaType("button");
              if (isEditMode) {
                handleUpdateCTA({ ctaType: "button" });
              }
            }}
          >
            <Square className="mr-2 w-4 h-4" />
            Button
          </Button>
          <Button
            variant={ctaType === "banner" ? "default" : "outline"}
            onClick={() => {
              setCtaType("banner");
              if (isEditMode) {
                handleUpdateCTA({ ctaType: "banner" });
              }
            }}
          >
            <div className="mr-2 w-4 h-1 bg-current"></div>
            Banner
          </Button>
          <Button
            variant={ctaType === "tag" ? "default" : "outline"}
            onClick={() => {
              setCtaType("tag");
              if (isEditMode) {
                handleUpdateCTA({ ctaType: "tag" });
              }
            }}
          >
            <div className="mr-2 w-3 h-3 border border-current transform rotate-45"></div>
            Tag
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cta-text">Button Text</Label>
        <Input
          id="cta-text"
          value={ctaText}
          onChange={handleCTATextInputChange}
          onBlur={() => {
            if (isEditMode) {
              handleUpdateCTA({ text: ctaText });
            }
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cta-color">Background Color</Label>
          <ColorPicker
            value={ctaColor}
            onChange={(color) => {
              setCtaColor(color);
              if (isEditMode) {
                handleUpdateCTA({ backgroundColor: color });
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta-text-color">Text Color</Label>
          <ColorPicker
            value={ctaTextColor}
            onChange={(color) => {
              setCtaTextColor(color);
              if (isEditMode) {
                handleUpdateCTA({ textColor: color });
              }
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Font Family</Label>
        <Select
          value={ctaFontFamily}
          onValueChange={(value) => {
            setCtaFontFamily(value);
            if (isEditMode) {
              handleUpdateCTA({ fontFamily: value });
            }
          }}
          disabled={loadingFonts}
        >
          <SelectTrigger id="cta-font-family">
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {availableFonts.map((fontName) => (
              <SelectItem
                key={fontName}
                value={fontName}
                style={{ fontFamily: fontName }}
              >
                {fontName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Font Weight</Label>
        <div className="flex flex-wrap gap-2">
          {availableWeights.map((weight) => (
            <Button
              key={weight}
              variant={ctaFontWeight === weight ? "default" : "outline"}
              onClick={() => {
                setCtaFontWeight(weight);
                if (isEditMode) {
                  handleUpdateCTA({ fontWeight: weight });
                }
              }}
              className="flex-1"
              size="sm"
            >
              {weight}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Font Size: {ctaFontSize}px</Label>
        <Slider
          id="cta-font-size"
          min={28}
          max={144}
          step={4}
          value={[ctaFontSize]}
          onValueChange={(value) => {
            const newSize = value[0];
            setCtaFontSize(newSize);
            if (isEditMode) {
              handleUpdateCTA({ fontSize: newSize });
            }
          }}
        />
      </div>

      {/* Border settings */}
      <div className="pt-2 space-y-4">
        <div className="flex justify-between items-center">
          <Label>Border</Label>
          <Switch
            checked={showBorderSettings}
            onCheckedChange={handleBorderToggle}
          />
        </div>

        {showBorderSettings && (
          <div className="pt-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Width</Label>
                <Slider
                  id="cta-border-width"
                  min={0}
                  max={10}
                  step={1}
                  value={[ctaBorderWidth]}
                  onValueChange={(value) => {
                    const newWidth = value[0];
                    setCtaBorderWidth(newWidth);
                    if (isEditMode) {
                      handleUpdateCTA({ borderWidth: newWidth });
                    }
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0px</span>
                  <span>5px</span>
                  <span>10px</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker
                  value={ctaBorderColor}
                  onChange={(color) => {
                    setCtaBorderColor(color);
                    if (isEditMode) {
                      handleUpdateCTA({ borderColor: color });
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Only show Add button in add mode */}
      {!isEditMode && (
        <Button onClick={handleAddCTA} className="mt-4 w-full">
          Add Call to Action
        </Button>
      )}
    </div>
  );
}
