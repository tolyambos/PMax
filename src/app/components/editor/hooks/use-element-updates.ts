import { useState, useCallback, useEffect } from "react";
import { useEditor } from "../context/editor-context";

/**
 * Custom hook to manage element properties updates in real-time
 * This ensures the UI updates immediately when element properties change
 */
export function useElementUpdates() {
  const { state, dispatch } = useEditor();

  // Handler for updating elements with immediate UI feedback
  const handleUpdateElement = useCallback(
    (sceneId: string, elementId: string, updates: any) => {
      console.log("Updating element:", { elementId, updates });

      // Immediately dispatch the update to the state
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          sceneId,
          elementId,
          updates: {
            ...updates,
            // Add a timestamp to force a re-render
            _updateTimestamp: Date.now(),
          },
        },
      });

      // Force a re-render in the UI
      const elementInCanvas = document.querySelector(
        `[data-element-id="${elementId}"]`
      );
      if (elementInCanvas) {
        // Set a data attribute to trigger CSS transitions
        elementInCanvas.setAttribute("data-updating", "true");

        // Remove the attribute after a short delay
        setTimeout(() => {
          elementInCanvas.removeAttribute("data-updating");
        }, 100);
      }

      // Check if this element is global and need sync
      if (state.globalElements.has(elementId)) {
        dispatch({
          type: "SYNC_GLOBAL_ELEMENT",
          payload: {
            elementId,
            updates,
          },
        });
      }
    },
    [dispatch, state.globalElements]
  );

  // Watch for element changes in the state
  useEffect(() => {
    // This effect intentionally left empty
    // It's here to cause re-renders when the state changes
  }, [state.scenes]);

  return {
    handleUpdateElement,
  };
}
