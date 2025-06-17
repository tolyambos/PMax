"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useEditor } from "./context/editor-context";
import {
  parseElementContent,
  normalizePercentage,
  getFontStack,
} from "../../utils/element-utils";
import { Element } from "./types";

interface ElementRendererProps {
  element: Element;
  sceneId: string;
  isInteractive?: boolean;
  handleDragStart?: (e: React.MouseEvent, elementId: string) => void;
  handleResizeStart?: (e: React.MouseEvent, elementId: string) => void;
  handleRotateStart?: (e: React.MouseEvent, elementId: string) => void;
  handleElementClick?: (e: React.MouseEvent, elementId: string) => void;
}

export function ElementRenderer({
  element,
  sceneId,
  isInteractive = false,
  handleDragStart,
  handleResizeStart,
  handleRotateStart,
  handleElementClick,
}: ElementRendererProps) {
  const { state, dispatch } = useEditor();

  // Track click state to differentiate between clicks and drags
  const [isClicking, setIsClicking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // State for refreshed S3 URLs
  const [refreshedElementUrl, setRefreshedElementUrl] = useState<string | null>(
    null
  );

  // Check if this element is selected
  const isSelected = state.selectedElementId === element.id;

  // Check if this is a global element
  const isGlobal = state.globalElements?.has(element.id) || false;

  // Destructure element properties first
  const {
    id,
    type,
    x,
    y,
    width,
    height,
    rotation,
    opacity,
    zIndex,
    url: elementUrl,
  } = element;

  // Function to refresh S3 URLs
  const refreshS3Url = async (url: string): Promise<string> => {
    if (
      !url ||
      (!url.includes("wasabisys.com") &&
        !url.includes("amazonaws.com") &&
        !url.includes("s3."))
    ) {
      return url;
    }

    try {
      const response = await fetch("/api/s3/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.presignedUrl || url;
      }
    } catch (error) {
      console.error("[refreshS3Url] Error refreshing S3 URL:", error);
    }

    return url;
  };

  // Effect to refresh element URL when element changes
  useEffect(() => {
    const refreshElementUrl = async () => {
      if (
        elementUrl &&
        (type === "image" ||
          type === "logo" ||
          type === "video" ||
          type === "audio")
      ) {
        try {
          const freshUrl = await refreshS3Url(elementUrl);
          setRefreshedElementUrl(freshUrl);
        } catch (error) {
          console.error(
            `[ElementRenderer] Failed to refresh URL for element ${id}:`,
            error
          );
          setRefreshedElementUrl(elementUrl);
        }
      } else {
        setRefreshedElementUrl(null);
      }
    };

    refreshElementUrl();
  }, [elementUrl, type, id]);

  // Parse element content to extract text, styles, etc.
  const {
    extractedText,
    extractedStyle,
    extractedShapeType,
    extractedCtaType,
    extractedFontFamily,
    extractedFontWeight,
  } = React.useMemo(() => parseElementContent(element), [element]);

  // Get font information
  const fontFamily = String(extractedFontFamily || "Roboto");
  const fontStack = getFontStack(fontFamily);

  // Helper function to parse any CSS color into rgba format for shadows
  const parseColorForShadow = (color: string, opacity: number): string => {
    // Default fallback
    if (!color) return `rgba(0, 0, 0, ${opacity})`;

    // Handle different color formats
    if (color.startsWith("rgba")) {
      // Already rgba format, just return it
      return color;
    } else if (color.startsWith("rgb")) {
      // Convert rgb to rgba
      return color.replace("rgb", "rgba").replace(")", `, ${opacity})`);
    } else if (color.startsWith("#")) {
      // Handle hex colors
      const hex = color.replace("#", "");
      // Convert 3-digit hex to 6-digit
      const fullHex =
        hex.length === 3
          ? hex
              .split("")
              .map((c) => c + c)
              .join("")
          : hex;

      // Convert hex to rgb
      const r = parseInt(fullHex.substring(0, 2), 16);
      const g = parseInt(fullHex.substring(2, 4), 16);
      const b = parseInt(fullHex.substring(4, 6), 16);

      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // For named colors and other formats, use a fallback
    return `rgba(0, 0, 0, ${opacity})`;
  };

  // Improved mouse event handlers for reliable selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;

    if (e.button === 0) {
      // Left mouse button
      setIsClicking(true);
      setIsDragging(false);

      // If this is a drag operation, let the drag handler take over
      if (handleDragStart) {
        handleDragStart(e, id);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isClicking) {
      setIsDragging(true);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isInteractive) return;

    // Only treat as a click if we haven't moved (not dragging)
    if (isClicking && !isDragging) {
      if (handleElementClick) {
        e.stopPropagation();

        // Explicitly select the element
        dispatch({ type: "SELECT_ELEMENT", payload: id });

        // Also call the provided handler
        handleElementClick(e, id);

        // Force focus away from any inputs to ensure state updates
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }

    setIsClicking(false);
    setIsDragging(false);
  };

  // Clean up event listeners when element unmounts
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsClicking(false);
      setIsDragging(false);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Calculate proper dimensions for image elements when keep proportions is enabled
  const getImageDimensions = () => {
    if (type === "image" || type === "logo") {
      const imageContent = element.content ? JSON.parse(element.content) : {};
      const keepProportions = imageContent.keepProportions !== false;

      if (keepProportions && width && height) {
        // When keep proportions is enabled, fit container tightly to image
        const aspectRatio = width / height;
        const normalizedWidth = normalizePercentage(width, 20);

        // Calculate height to maintain exact image aspect ratio
        const fittedHeight = normalizedWidth / aspectRatio;

        return {
          width: `${normalizedWidth}%`,
          height: `${fittedHeight}%`,
        };
      }
    }

    // Default behavior for other elements or when keep proportions is disabled
    return {
      width: width ? `${normalizePercentage(width, 20)}%` : "auto",
      height: height ? `${normalizePercentage(height, 20)}%` : "auto",
    };
  };

  const imageDimensions = getImageDimensions();

  // Common style for all elements - ensure we use percentage values for positioning
  const commonStyle: React.CSSProperties = {
    position: "absolute" as const,
    left: `${normalizePercentage(x, 0)}%`,
    top: `${normalizePercentage(y, 0)}%`,
    width: imageDimensions.width,
    height: imageDimensions.height,
    transform: `rotate(${rotation || 0}deg)`,
    transformOrigin: "center center",
    opacity: opacity || 1,
    zIndex: zIndex || 0,
    // Special handling for image borders based on keep proportions setting
    border: (() => {
      if (type === "image" || type === "logo") {
        const imageContent = element.content ? JSON.parse(element.content) : {};
        const keepProportions = imageContent.keepProportions !== false;
        // Only show border when NOT keeping proportions (fill mode)
        if (!keepProportions && isInteractive) {
          return isSelected
            ? "2px solid #3b82f6"
            : "1px dashed rgba(0, 0, 0, 0.2)";
        }
        return "none";
      }
      // Original logic for other element types
      return type !== "cta" && isInteractive
        ? isSelected
          ? "2px solid #3b82f6"
          : "1px dashed rgba(0, 0, 0, 0.2)"
        : "none";
    })(),
    boxSizing: "border-box" as const,
    cursor: isInteractive ? "move" : "default",
    transition: "border-color 0.2s ease",
  };

  // Special style for CTA selection border (wrapper div)
  const ctaWrapperStyle: React.CSSProperties =
    type === "cta" && isInteractive
      ? {
          position: "absolute" as const,
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          border: isSelected
            ? "2px solid #3b82f6"
            : "1px dashed rgba(0, 0, 0, 0.2)",
          boxSizing: "border-box" as const,
          pointerEvents: "none", // Allow clicks to pass through to the CTA element
          zIndex: 1,
        }
      : {};

  // Render element based on type
  const renderElementContent = () => {
    switch (type) {
      case "text":
        return (
          <div
            style={{
              ...commonStyle,
              color: extractedStyle?.color
                ? String(extractedStyle.color)
                : "#FFFFFF",
              fontSize: extractedStyle?.fontSize || "48px",
              fontWeight: extractedFontWeight || "normal",
              fontFamily: fontStack,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              userSelect: "none",
              textShadow:
                typeof extractedStyle?.textShadow === "object" &&
                extractedStyle?.textShadow !== null &&
                (extractedStyle.textShadow as any).enabled === true
                  ? `${(extractedStyle.textShadow as any).blur || 1}px ${(extractedStyle.textShadow as any).blur || 1}px ${(extractedStyle.textShadow as any).blur || 2}px ${parseColorForShadow((extractedStyle.textShadow as any).color || "", (extractedStyle.textShadow as any).opacity !== undefined ? Number((extractedStyle.textShadow as any).opacity) : 0.5)}`
                  : extractedStyle?.textShadow === undefined
                    ? "0px 1px 2px rgba(0, 0, 0, 0.5)" // For backward compatibility
                    : "none",
              backgroundColor: extractedStyle?.backgroundColor
                ? String(extractedStyle.backgroundColor)
                : "transparent",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              console.log("Text element clicked:", id);

              // Forcefully select the element to be sure
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
            className={`element-renderer element-text ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="text"
            data-selected={isSelected ? "true" : "false"}
          >
            {extractedText || "Text"}
            {renderElementControls()}
          </div>
        );

      case "shape":
        let shapeStyles: React.CSSProperties = {
          ...commonStyle,
          backgroundColor: extractedStyle?.backgroundColor
            ? String(extractedStyle.backgroundColor)
            : "#3B82F6",
          opacity: extractedStyle?.opacity || 0.8,
        };

        // Adjust style based on shape type
        if (extractedShapeType === "circle") {
          shapeStyles = {
            ...shapeStyles,
            borderRadius: "50%",
          };
        } else if (extractedShapeType === "triangle") {
          // For triangle, we use clip-path
          return (
            <div
              style={{
                ...shapeStyles,
                clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "SELECT_ELEMENT", payload: id });
              }}
              className={`element-renderer element-shape ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
              data-element-id={id}
              data-element-type="shape"
              data-shape-type={extractedShapeType}
              data-selected={isSelected ? "true" : "false"}
            >
              {renderElementControls()}
            </div>
          );
        }

        return (
          <div
            style={shapeStyles}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
            className={`element-renderer element-shape ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="shape"
            data-shape-type={extractedShapeType}
            data-selected={isSelected ? "true" : "false"}
          >
            {renderElementControls()}
          </div>
        );

      case "cta":
        // Create font stack for CTA
        const ctaFontFamily = String(extractedStyle?.fontFamily || "Roboto");
        const ctaFontStack = getFontStack(ctaFontFamily);

        return (
          <div
            style={{
              position: "absolute",
              left: `${normalizePercentage(x, 0)}%`,
              top: `${normalizePercentage(y, 0)}%`,
              width: width ? `${normalizePercentage(width, 20)}%` : "auto", // Use normalized width value for consistency
              height: height ? `${normalizePercentage(height, 20)}%` : "auto", // Use normalized height value for consistency
              transform: `rotate(${rotation || 0}deg)`,
              transformOrigin: "center center",
              opacity: opacity || 1,
              zIndex: zIndex || 0,
              border: isInteractive
                ? isSelected
                  ? "2px solid #3b82f6"
                  : "1px dashed rgba(0, 0, 0, 0.2)"
                : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isInteractive ? "move" : "default",
              boxSizing: "border-box",
            }}
            className={`element-renderer element-cta ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="cta"
            data-cta-type={extractedCtaType}
            data-selected={isSelected ? "true" : "false"}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              console.log("CTA element clicked:", id);
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
          >
            <div
              style={{
                backgroundColor: extractedStyle?.backgroundColor
                  ? String(extractedStyle.backgroundColor)
                  : "#10B981",
                color: extractedStyle?.color
                  ? String(extractedStyle.color)
                  : "#FFFFFF",
                fontSize: extractedStyle?.fontSize || "36px",
                fontWeight: extractedStyle?.fontWeight
                  ? String(extractedStyle.fontWeight)
                  : "bold",
                fontFamily: ctaFontStack,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                userSelect: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                borderWidth: extractedStyle?.borderWidth
                  ? String(extractedStyle.borderWidth)
                  : undefined,
                borderColor: extractedStyle?.borderColor
                  ? String(extractedStyle.borderColor)
                  : undefined,
                borderRadius: extractedStyle?.borderRadius
                  ? String(extractedStyle.borderRadius)
                  : undefined,
                borderStyle:
                  extractedStyle?.borderWidth &&
                  parseFloat(String(extractedStyle.borderWidth)) > 0
                    ? ((extractedStyle?.borderStyle
                        ? String(extractedStyle.borderStyle)
                        : "solid") as React.CSSProperties["borderStyle"])
                    : ("none" as React.CSSProperties["borderStyle"]),
                boxShadow: extractedStyle?.boxShadow
                  ? String(extractedStyle.boxShadow)
                  : undefined,
                width: "100%",
                height: "100%",
                boxSizing: "border-box" as React.CSSProperties["boxSizing"],
              }}
            >
              {extractedText || "Shop Now"}
            </div>
            {renderElementControls()}
          </div>
        );

      case "logo":
      case "image":
        const imageContent = element.content ? JSON.parse(element.content) : {};
        const keepProportions = imageContent.keepProportions !== false; // default to true

        return (
          <div
            style={{
              ...commonStyle,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
            className={`element-renderer element-image ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="image"
            data-selected={isSelected ? "true" : "false"}
          >
            {elementUrl ? (
              <div
                style={{ position: "relative", width: "100%", height: "100%" }}
              >
                <Image
                  src={refreshedElementUrl || elementUrl}
                  alt="Element image"
                  fill
                  style={{
                    objectFit: keepProportions ? "contain" : "fill",
                  }}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                />
                {/* Show actual image bounds when keep proportions is enabled */}
                {keepProportions && isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: "0",
                      left: "0",
                      right: "0",
                      bottom: "0",
                      border: "2px solid #3b82f6",
                      borderRadius: "4px",
                      pointerEvents: "none",
                      boxSizing: "border-box",
                      // Add visual indicator text
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#3b82f6",
                        color: "white",
                        fontSize: "10px",
                        padding: "2px 4px",
                        borderRadius: "2px",
                        margin: "4px",
                      }}
                    >
                      Proportions locked
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: "12px",
                  borderRadius: "4px",
                }}
              >
                No Image
              </div>
            )}
            {renderElementControls()}
          </div>
        );

      case "video":
        return (
          <div
            style={{
              ...commonStyle,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
            className={`element-renderer element-video ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="video"
            data-selected={isSelected ? "true" : "false"}
          >
            {elementUrl ? (
              <video
                src={refreshedElementUrl || elementUrl}
                className="object-contain w-full h-full"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                Video
              </div>
            )}
            {renderElementControls()}
          </div>
        );

      case "audio":
        return (
          <div
            style={{
              ...commonStyle,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
            className={`element-renderer element-audio ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="audio"
            data-selected={isSelected ? "true" : "false"}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#f1f5f9",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2"
              >
                <path
                  d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 20L8 16M12 20L16 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-xs">Audio Element</span>
              {elementUrl && (
                <audio
                  src={refreshedElementUrl || elementUrl}
                  style={{ display: "none" }}
                />
              )}
            </div>
            {renderElementControls()}
          </div>
        );

      default:
        return (
          <div
            style={{
              ...commonStyle,
              backgroundColor: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              padding: "12px",
              borderRadius: "4px",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_ELEMENT", payload: id });
            }}
            className={`element-renderer element-unknown ${isSelected ? "element-selected" : ""} ${isGlobal ? "element-global" : ""}`}
            data-element-id={id}
            data-element-type="unknown"
            data-selected={isSelected ? "true" : "false"}
          >
            Unknown Element
            {renderElementControls()}
          </div>
        );
    }
  };

  // Render controls for interactive elements
  const renderElementControls = () => {
    if (!isInteractive || !isSelected) return null;

    return (
      <div className="element-controls">
        {/* Resize handle */}
        <div
          className="flex absolute -right-3 -bottom-3 z-20 justify-center items-center w-6 h-6 bg-blue-500 rounded-full border-2 border-white cursor-se-resize"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (handleResizeStart) {
              handleResizeStart(e, id);
            }
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22 22H16M22 22V16M22 22L16 16M16 16L11 11"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Rotate handle */}
        <div
          className="flex absolute -top-3 -right-3 z-20 justify-center items-center w-6 h-6 bg-green-500 rounded-full border-2 border-white cursor-pointer"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (handleRotateStart) {
              handleRotateStart(e, id);
            }
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M12 20L8 16M12 20L16 16"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Global element indicator */}
        {isGlobal && (
          <div className="flex absolute -top-3 -left-3 z-20 justify-center items-center w-6 h-6 bg-indigo-500 rounded-full border-2 border-white">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10h-3"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return renderElementContent();
}
