"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import { ColorPicker } from "@/app/components/ui/color-picker";
import { Square, Circle } from "lucide-react";

import { createElementContent } from "@/app/utils/element-utils";
import { Element } from "./../types";

// Define shape types
export type ShapeType = "rectangle" | "circle" | "triangle";

interface ShapeElementEditorProps {
  selectedElement?: Element;
  sceneId: string;
  onUpdateElement?: (sceneId: string, elementId: string, updates: any) => void;
  onAddElement?: (elementConfig: any) => void;
  isEditMode: boolean;
}

export default function ShapeElementEditor({
  selectedElement,
  sceneId,
  onUpdateElement,
  onAddElement,
  isEditMode,
}: ShapeElementEditorProps) {
  // Shape element state
  const [shapeType, setShapeType] = useState<ShapeType>("rectangle");
  const [shapeColor, setShapeColor] = useState<string>("#3B82F6");
  const [shapeOpacity, setShapeOpacity] = useState<number>(0.8);

  // Initialize state from selected element if present
  useEffect(() => {
    if (selectedElement && selectedElement.type === "shape") {
      try {
        // Parse shape content
        if (
          typeof selectedElement.content === "string" &&
          selectedElement.content.trim().startsWith("{")
        ) {
          const parsedContent = JSON.parse(selectedElement.content);

          // Set shape type if available
          if (parsedContent.shapeType) {
            setShapeType(parsedContent.shapeType as ShapeType);
          }

          // Set color if available
          if (parsedContent.style && parsedContent.style.backgroundColor) {
            setShapeColor(parsedContent.style.backgroundColor);
          }

          // Set opacity if available
          if (parsedContent.style && parsedContent.style.opacity) {
            setShapeOpacity(Number(parsedContent.style.opacity));
          } else if (selectedElement.opacity) {
            setShapeOpacity(Number(selectedElement.opacity));
          }
        }
      } catch (e) {
        console.error("Error parsing selected element content:", e);
      }
    }
  }, [selectedElement?.id]);

  // Add shape element
  const handleAddShape = () => {
    if (!onAddElement) return;

    onAddElement({
      type: "shape",
      content: createElementContent(
        "", // No text for shapes
        {
          backgroundColor: shapeColor,
          opacity: shapeOpacity,
        },
        { shapeType } // Add shapeType as additional property
      ),
      x: Math.round(20), // Position near top-left
      y: Math.round(40), // Position in middle
      width: Math.round(40), // Percentage of canvas width
      height: Math.round(40), // Percentage of canvas height
      rotation: 0,
      opacity: shapeOpacity,
      zIndex: 5,
    });
  };

  // Update shape element
  const handleUpdateShape = (
    updates: Partial<{
      shapeType: ShapeType;
      backgroundColor: string;
      opacity: number;
    }> = {}
  ) => {
    if (
      !selectedElement ||
      !onUpdateElement ||
      selectedElement.type !== "shape"
    )
      return;

    const updatedShapeType = updates.shapeType || shapeType;
    const updatedColor = updates.backgroundColor || shapeColor;
    const updatedOpacity =
      updates.opacity !== undefined ? updates.opacity : shapeOpacity;

    console.log("Updating shape element with values:", {
      shapeType: updatedShapeType,
      shapeColor: updatedColor,
      shapeOpacity: updatedOpacity,
    });

    // Immediately update the element
    onUpdateElement(sceneId, selectedElement.id, {
      content: createElementContent(
        "", // No text for shapes
        {
          backgroundColor: updatedColor,
          opacity: updatedOpacity,
        },
        { shapeType: updatedShapeType } // Add shapeType as additional property
      ),
      opacity: updatedOpacity,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="shape-type">Shape Type</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={shapeType === "rectangle" ? "default" : "outline"}
            onClick={() => {
              setShapeType("rectangle");
              if (isEditMode) {
                handleUpdateShape({ shapeType: "rectangle" });
              }
            }}
          >
            <Square className="mr-2 w-4 h-4" />
            Rectangle
          </Button>
          <Button
            variant={shapeType === "circle" ? "default" : "outline"}
            onClick={() => {
              setShapeType("circle");
              if (isEditMode) {
                handleUpdateShape({ shapeType: "circle" });
              }
            }}
          >
            <Circle className="mr-2 w-4 h-4" />
            Circle
          </Button>
          <Button
            variant={shapeType === "triangle" ? "default" : "outline"}
            onClick={() => {
              setShapeType("triangle");
              if (isEditMode) {
                handleUpdateShape({ shapeType: "triangle" });
              }
            }}
          >
            <div className="mr-2 w-4 h-4 transform rotate-180">▲</div>
            Triangle
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shape-color">Shape Color</Label>
        <ColorPicker
          value={shapeColor}
          onChange={(color) => {
            setShapeColor(color);
            if (isEditMode) {
              handleUpdateShape({ backgroundColor: color });
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shape-opacity">
          Opacity: {shapeOpacity.toFixed(1)}
        </Label>
        <Slider
          id="shape-opacity"
          min={0.1}
          max={1.0}
          step={0.1}
          value={[shapeOpacity]}
          onValueChange={(value) => {
            const newOpacity = value[0];
            setShapeOpacity(newOpacity);
            if (isEditMode) {
              handleUpdateShape({ opacity: newOpacity });
            }
          }}
        />
      </div>

      {/* Only show Add button in add mode */}
      {!isEditMode && (
        <Button onClick={handleAddShape} className="mt-4 w-full">
          Add Shape
        </Button>
      )}
    </div>
  );
}
