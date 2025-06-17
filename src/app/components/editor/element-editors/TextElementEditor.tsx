"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import { ColorPicker } from "@/app/components/ui/color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

import { createElementContent } from "@/app/utils/element-utils";
import { Element } from "./../types";
import {
  getAllFontFamilies,
  getAvailableWeights,
  preloadFont,
} from "@/app/utils/fonts";

interface TextElementEditorProps {
  selectedElement?: Element;
  sceneId: string;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onAddElement?: (elementConfig: any) => void;
  isEditMode: boolean;
}

export default function TextElementEditor({
  selectedElement,
  sceneId,
  onUpdateElement,
  onAddElement,
  isEditMode,
}: TextElementEditorProps) {
  // Text element state
  const [textContent, setTextContent] = useState<string>("Add your text here");
  const [textColor, setTextColor] = useState<string>("#FFFFFF");
  const [fontSize, setFontSize] = useState<number>(48);
  const [fontFamily, setFontFamily] = useState<string>("Roboto");
  const [fontWeight, setFontWeight] = useState<string>("400");

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
        if (fonts.length > 0 && !fonts.includes(fontFamily)) {
          setFontFamily(fonts[0]);
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
        await preloadFont(fontFamily);

        // Get available weights for the selected font
        const weights = await getAvailableWeights(fontFamily);
        setAvailableWeights(weights);

        // Set a default weight if current weight is not available in this font
        if (!weights.includes(fontWeight)) {
          const newWeight = weights.includes("400") ? "400" : weights[0];
          setFontWeight(newWeight);
        }
      } catch (error) {
        console.error(`Error loading weights for ${fontFamily}:`, error);
      }
    };

    if (fontFamily) {
      loadFontWeights();
    }
  }, [fontFamily, fontWeight]);

  // Initialize state from selected element if present
  useEffect(() => {
    if (selectedElement && selectedElement.type === "text") {
      try {
        // Parse the content if it's a valid JSON
        if (
          typeof selectedElement.content === "string" &&
          selectedElement.content.trim().startsWith("{")
        ) {
          const parsedContent = JSON.parse(selectedElement.content);
          setTextContent(parsedContent.text || "");

          // Set color if available
          if (parsedContent.style && parsedContent.style.color) {
            setTextColor(parsedContent.style.color);
          }

          // Set font size if available
          if (parsedContent.style && parsedContent.style.fontSize) {
            const fontSizeMatch = parsedContent.style.fontSize.match(/(\d+)/);
            if (fontSizeMatch) {
              setFontSize(Number(fontSizeMatch[0]));
            }
          }

          // Set font weight if available
          if (parsedContent.style && parsedContent.style.fontWeight) {
            setFontWeight(parsedContent.style.fontWeight.toString());
          }

          // Set font family if available
          if (parsedContent.style && parsedContent.style.fontFamily) {
            setFontFamily(parsedContent.style.fontFamily);
          }
        } else {
          // Handle plain text content (not wrapped in JSON)
          setTextContent(selectedElement.content || "");
        }
      } catch (e) {
        console.error("Error parsing selected element content:", e);
      }
    }
  }, [selectedElement?.id]);

  // Add text element
  const handleAddText = () => {
    if (!onAddElement) return;

    const styleOptions: any = {
      color: textColor,
      fontSize: `${fontSize}px`,
      fontWeight: fontWeight,
      fontFamily: fontFamily,
    };

    onAddElement({
      type: "text",
      content: createElementContent(textContent, styleOptions),
      x: Math.round(10),
      y: Math.round(10),
      width: Math.round(80),
      height: Math.round(20),
      rotation: 0,
      opacity: 1,
      zIndex: 10,
    });
  };

  // Update text element
  const handleUpdateText = (overrides: any = {}) => {
    if (!selectedElement || !onUpdateElement || selectedElement.type !== "text")
      return;

    // Use provided overrides or current state values
    const currentValues = {
      textContent: overrides.textContent ?? textContent,
      textColor: overrides.textColor ?? textColor,
      fontSize: overrides.fontSize ?? fontSize,
      fontWeight: overrides.fontWeight ?? fontWeight,
      fontFamily: overrides.fontFamily ?? fontFamily,
    };

    console.log("Updating text element with values:", currentValues);

    const styleOptions: any = {
      color: currentValues.textColor,
      fontSize: `${currentValues.fontSize}px`,
      fontWeight: currentValues.fontWeight,
      fontFamily: currentValues.fontFamily,
    };

    onUpdateElement(sceneId, selectedElement.id, {
      content: createElementContent(currentValues.textContent, styleOptions),
    });
  };

  // Add debounced update function for text
  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTextContent(newValue);

    // Update preview immediately but don't save to database yet
    if (selectedElement && selectedElement.type === "text" && onUpdateElement) {
      const styleOptions: any = {
        color: textColor,
        fontSize: `${fontSize}px`,
        fontWeight: fontWeight,
        fontFamily: fontFamily,
      };

      // Use a special flag to indicate this is a preview update
      onUpdateElement(sceneId, selectedElement.id, {
        content: createElementContent(newValue, styleOptions),
        _previewOnly: true,
      });
    }
  };

  // Final update function for when input loses focus
  const handleTextInputBlur = () => {
    if (selectedElement && selectedElement.type === "text" && onUpdateElement) {
      const styleOptions: any = {
        color: textColor,
        fontSize: `${fontSize}px`,
        fontWeight: fontWeight,
        fontFamily: fontFamily,
      };

      // Save permanently when focus is lost
      onUpdateElement(sceneId, selectedElement.id, {
        content: createElementContent(textContent, styleOptions),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text-content">Text Content</Label>
        <Input
          id="text-content"
          value={textContent}
          onChange={handleTextInputChange}
          onBlur={handleTextInputBlur}
        />
      </div>

      {/* Font Family Selector */}
      <div className="space-y-2">
        <Label htmlFor="font-family">
          Font Family {loadingFonts && "(Loading...)"}
        </Label>
        <Select
          value={fontFamily}
          onValueChange={(value) => {
            setFontFamily(value);
            if (isEditMode) {
              handleUpdateText({ fontFamily: value });
            }
          }}
          disabled={loadingFonts}
        >
          <SelectTrigger id="font-family">
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
        <Label htmlFor="text-color">Text Color</Label>
        <ColorPicker
          value={textColor}
          onChange={(color) => {
            setTextColor(color);
            if (isEditMode) {
              handleUpdateText({ textColor: color });
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="font-size">Font Size: {fontSize}px</Label>
        <Slider
          id="font-size"
          min={16}
          max={144}
          step={4}
          value={[fontSize]}
          onValueChange={(value) => {
            const newSize = value[0];
            setFontSize(newSize);
            if (isEditMode) {
              handleUpdateText({ fontSize: newSize });
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Font Weight</Label>
        <div className="flex flex-wrap gap-2">
          {availableWeights.map((weight) => (
            <Button
              key={weight}
              variant={fontWeight === weight ? "default" : "outline"}
              onClick={() => {
                setFontWeight(weight);
                if (isEditMode) {
                  handleUpdateText({ fontWeight: weight });
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

      {/* Only show Add button in add mode */}
      {!isEditMode && (
        <Button onClick={handleAddText} className="mt-4 w-full">
          Add Text
        </Button>
      )}
    </div>
  );
}
