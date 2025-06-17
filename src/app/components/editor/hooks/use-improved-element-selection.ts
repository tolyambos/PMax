/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor } from "../context/editor-context";

/**
 * Custom hook to manage element selection with improved synchronization
 * between canvas and side panel
 */
export function useImprovedElementSelection() {
  const { state, dispatch } = useEditor();
  const [lastSelectedElementId, setLastSelectedElementId] = useState<
    string | null
  >(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle element click for selection with persistence
  const handleElementClick = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      console.log("Element clicked for selection:", elementId);

      // Always select the element (don't toggle)
      // This ensures persistent selection
      dispatch({ type: "SELECT_ELEMENT", payload: elementId });

      // Save the selected element ID for comparison
      setLastSelectedElementId(elementId);

      // Force focus away from any active text inputs to ensure state updates are visible
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Add a class to the body to indicate element selection mode
      document.body.classList.add("element-selected-mode");

      // Clear any existing timeout
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }

      // Set a timeout to prevent accidental deselection immediately after click
      selectionTimeoutRef.current = setTimeout(() => {
        selectionTimeoutRef.current = null;
      }, 300);
    },
    [dispatch]
  );

  // Handle deselecting elements when clicking on canvas
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // Don't deselect if we're in the timing window right after selection
      if (selectionTimeoutRef.current) return;

      // Deselect any selected element
      if (state.selectedElementId) {
        console.log("Canvas clicked, clearing element selection");
        setLastSelectedElementId(null);
        dispatch({ type: "SELECT_ELEMENT", payload: null });

        // Remove element selection mode class
        document.body.classList.remove("element-selected-mode");
      }
    },
    [state.selectedElementId, dispatch]
  );

  // Handle keyboard events for escaping selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.selectedElementId) {
        // Clear selection on Escape key
        setLastSelectedElementId(null);
        dispatch({ type: "SELECT_ELEMENT", payload: null });
        document.body.classList.remove("element-selected-mode");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.selectedElementId, dispatch]);

  // Force an immediate update in the side panel when selection changes
  useEffect(() => {
    if (state.selectedElementId !== lastSelectedElementId) {
      // Force DOM updates by adding a small timeout
      setTimeout(() => {
        // Find the element in the DOM
        const selectedElement = document.querySelector(
          `[data-element-id="${state.selectedElementId}"]`
        );

        if (selectedElement) {
          // Add a selection attribute
          selectedElement.setAttribute("data-selected", "true");

          // Trigger a redraw
          // @ts-ignore - used to force a repaint
          selectedElement.offsetHeight;

          // Scroll the element into view in the side panel
          const panelElement = document.querySelector(
            `.element-list [data-element-id="${state.selectedElementId}"]`
          );

          if (panelElement) {
            panelElement.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }

        setLastSelectedElementId(state.selectedElementId);
      }, 50);
    }
  }, [state.selectedElementId, lastSelectedElementId]);

  // When component unmounts, clean up any timeouts
  useEffect(() => {
    return () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  return {
    selectedElementId: state.selectedElementId,
    handleElementClick,
    handleCanvasClick,
  };
}
