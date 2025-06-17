/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useCallback, useRef, RefObject } from "react";
import { useEditor } from "../context/editor-context";
import { Element, Scene } from "../types";
import { normalizePercentage } from "@/app/utils/element-utils";

interface UseElementManipulationOptions {
  canvasRef: RefObject<HTMLDivElement>;
}

/**
 * Hook for handling element manipulation (drag, resize, rotate)
 */
export function useElementManipulation({
  canvasRef,
}: UseElementManipulationOptions) {
  const { state, dispatch } = useEditor();
  const { selectedSceneId } = state;

  // States for tracking manipulation
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [resizingElementId, setResizingElementId] = useState<string | null>(
    null
  );
  const [rotatingElementId, setRotatingElementId] = useState<string | null>(
    null
  );

  // Refs for storing manipulation data
  const dragInfoRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    elementStartX: number;
    elementStartY: number;
    sceneId: string;
  } | null>(null);

  const resizeInfoRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    sceneId: string;
  } | null>(null);

  const rotateInfoRef = useRef<{
    elementId: string;
    startAngle: number;
    centerX: number;
    centerY: number;
    currentRotation: number;
    sceneId: string;
  } | null>(null);

  // Get the currently active scene
  const currentScene = selectedSceneId
    ? state.scenes.find((scene) => scene.id === selectedSceneId)
    : null;

  /**
   * Handle starting an element drag operation
   */
  const handleDragStart = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      if (!selectedSceneId || !currentScene) return;

      e.stopPropagation();
      e.preventDefault();

      // Find the element by ID
      const element = currentScene.elements.find((el) => el.id === elementId);
      if (!element) return;

      // Set the element as selected
      dispatch({ type: "SELECT_ELEMENT", payload: elementId });

      // Ensure element position is a number before starting drag
      const elementX =
        typeof element.x === "number"
          ? element.x
          : parseFloat(String(element.x)) || 0;
      const elementY =
        typeof element.y === "number"
          ? element.y
          : parseFloat(String(element.y)) || 0;

      // Save drag info for use during move - with explicit parseFloat for safety
      dragInfoRef.current = {
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        elementStartX: elementX,
        elementStartY: elementY,
        sceneId: selectedSceneId,
      };

      // Log the starting position for debugging
      console.log(`Starting drag for element ${elementId}:`, {
        startX: e.clientX,
        startY: e.clientY,
        elementStartX: elementX,
        elementStartY: elementY,
      });

      // Update state for UI feedback
      setDraggedElementId(elementId);

      // Add document-level event listeners
      document.addEventListener("mousemove", handleDragging);
      document.addEventListener("mouseup", handleDragEnd);

      // Set data attribute on body for CSS effects
      document.body.setAttribute("data-dragging-element-id", elementId);
    },
    [selectedSceneId, currentScene, dispatch]
  );

  /**
   * Handle element dragging - CRITICAL function for position consistency
   */
  const handleDragging = useCallback(
    (e: MouseEvent) => {
      const dragInfo = dragInfoRef.current;
      if (!dragInfo || !canvasRef.current) return;

      // Calculate the delta position
      const deltaX = e.clientX - dragInfo.startX;
      const deltaY = e.clientY - dragInfo.startY;

      // Get the canvas dimensions for percentage calculations
      const canvasRect = canvasRef.current.getBoundingClientRect();

      // CRITICAL: Convert to percentage values using the EXACT SAME formula
      // that will be used during rendering
      const percentageDeltaX = (deltaX / canvasRect.width) * 100;
      const percentageDeltaY = (deltaY / canvasRect.height) * 100;

      // Calculate new position ensuring it stays within the 0-100 range
      // CRITICAL: Use normalizePercentage to ensure consistent behavior
      const newX = normalizePercentage(
        dragInfo.elementStartX + percentageDeltaX,
        0
      );
      const newY = normalizePercentage(
        dragInfo.elementStartY + percentageDeltaY,
        0
      );

      // Log the calculated position for debugging
      console.log(`Dragging element ${dragInfo.elementId}:`, {
        deltaX,
        deltaY,
        percentageDeltaX,
        percentageDeltaY,
        newX,
        newY,
      });

      // Update the element position with rounded values for consistency
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          sceneId: dragInfo.sceneId,
          elementId: dragInfo.elementId,
          updates: {
            x: Math.round(newX * 100) / 100,
            y: Math.round(newY * 100) / 100,
          },
        },
      });
    },
    [canvasRef, dispatch]
  );

  /**
   * Handle ending an element drag operation
   */
  const handleDragEnd = useCallback(() => {
    // Remove event listeners
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", handleDragEnd);

    // Log the final position
    if (dragInfoRef.current) {
      console.log(`Finished dragging element ${dragInfoRef.current.elementId}`);
    }

    // Clear drag info and state
    dragInfoRef.current = null;
    setDraggedElementId(null);

    // Remove data attribute from body
    document.body.removeAttribute("data-dragging-element-id");

    // Trigger an immediate sync to save position changes to the database
    dispatch({ type: "SAVE_PROJECT" });
  }, [handleDragging, dispatch]);

  /**
   * Handle starting an element resize operation
   */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      if (!selectedSceneId || !currentScene) return;

      e.stopPropagation();
      e.preventDefault();

      // Find the element by ID
      const element = currentScene.elements.find((el) => el.id === elementId);
      if (!element) return;

      // Set the element as selected
      dispatch({ type: "SELECT_ELEMENT", payload: elementId });

      // Ensure element dimensions are numbers before starting resize
      const elementWidth =
        typeof element.width === "number"
          ? element.width
          : parseFloat(String(element.width)) || 20;
      const elementHeight =
        typeof element.height === "number"
          ? element.height
          : parseFloat(String(element.height)) || 20;

      // Save resize info for use during resize
      resizeInfoRef.current = {
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: elementWidth,
        startHeight: elementHeight,
        sceneId: selectedSceneId,
      };

      // Log the starting size for debugging
      console.log(`Starting resize for element ${elementId}:`, {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: elementWidth,
        startHeight: elementHeight,
      });

      // Update state for UI feedback
      setResizingElementId(elementId);

      // Add document-level event listeners
      document.addEventListener("mousemove", handleResizing);
      document.addEventListener("mouseup", handleResizeEnd);
    },
    [selectedSceneId, currentScene, dispatch]
  );

  /**
   * Handle element resizing - CRITICAL function for size consistency
   */
  const handleResizing = useCallback(
    (e: MouseEvent) => {
      const resizeInfo = resizeInfoRef.current;
      if (!resizeInfo || !canvasRef.current) return;

      // Calculate the delta values
      const deltaX = e.clientX - resizeInfo.startX;
      const deltaY = e.clientY - resizeInfo.startY;

      // Get the canvas dimensions for percentage calculations
      const canvasRect = canvasRef.current.getBoundingClientRect();

      // CRITICAL: Convert to percentage values using the EXACT SAME formula
      // that will be used during rendering
      const percentageDeltaX = (deltaX / canvasRect.width) * 100;
      const percentageDeltaY = (deltaY / canvasRect.height) * 100;

      // Calculate new size with minimum dimensions
      // CRITICAL: Use normalizePercentage to ensure consistent behavior
      const newWidth = normalizePercentage(
        resizeInfo.startWidth + percentageDeltaX,
        5
      );
      const newHeight = normalizePercentage(
        resizeInfo.startHeight + percentageDeltaY,
        5
      );

      // Log the calculated size for debugging
      console.log(`Resizing element ${resizeInfo.elementId}:`, {
        deltaX,
        deltaY,
        percentageDeltaX,
        percentageDeltaY,
        newWidth,
        newHeight,
      });

      // Update the element size with rounded values for consistency
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          sceneId: resizeInfo.sceneId,
          elementId: resizeInfo.elementId,
          updates: {
            width: Math.round(newWidth * 100) / 100,
            height: Math.round(newHeight * 100) / 100,
          },
        },
      });
    },
    [canvasRef, dispatch]
  );

  /**
   * Handle ending an element resize operation
   */
  const handleResizeEnd = useCallback(() => {
    // Remove event listeners
    document.removeEventListener("mousemove", handleResizing);
    document.removeEventListener("mouseup", handleResizeEnd);

    // Log the final size
    if (resizeInfoRef.current) {
      console.log(
        `Finished resizing element ${resizeInfoRef.current.elementId}`
      );
    }

    // Clear resize info and state
    resizeInfoRef.current = null;
    setResizingElementId(null);

    // Remove data attribute from body
    document.body.removeAttribute("data-resizing-element-id");

    // Trigger an immediate sync to save size changes to the database
    dispatch({ type: "SAVE_PROJECT" });
  }, [handleResizing, dispatch]);

  /**
   * Handle starting an element rotation operation
   */
  const handleRotateStart = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      if (!selectedSceneId || !currentScene) return;

      e.stopPropagation();
      e.preventDefault();

      // Find the element by ID
      const element = currentScene.elements.find((el) => el.id === elementId);
      if (!element) return;

      // Set the element as selected
      dispatch({ type: "SELECT_ELEMENT", payload: elementId });

      // Find the center of the element for rotation calculations
      const elementRect = (
        e.currentTarget as HTMLElement
      ).getBoundingClientRect();
      const centerX = elementRect.left + elementRect.width / 2;
      const centerY = elementRect.top + elementRect.height / 2;

      // Calculate the starting angle (mouse position relative to center)
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

      // Ensure element rotation is a number
      const elementRotation =
        typeof element.rotation === "number"
          ? element.rotation
          : parseFloat(String(element.rotation)) || 0;

      // Save rotation info for use during rotate
      rotateInfoRef.current = {
        elementId,
        startAngle,
        centerX,
        centerY,
        currentRotation: elementRotation,
        sceneId: selectedSceneId,
      };

      // Log the starting rotation for debugging
      console.log(`Starting rotation for element ${elementId}:`, {
        startAngle,
        centerX,
        centerY,
        currentRotation: elementRotation,
      });

      // Update state for UI feedback
      setRotatingElementId(elementId);

      // Add document-level event listeners
      document.addEventListener("mousemove", handleRotating);
      document.addEventListener("mouseup", handleRotateEnd);
    },
    [selectedSceneId, currentScene, dispatch]
  );

  /**
   * Handle element rotating - CRITICAL function for rotation consistency
   */
  const handleRotating = useCallback(
    (e: MouseEvent) => {
      const rotateInfo = rotateInfoRef.current;
      if (!rotateInfo) return;

      // Calculate the current angle in radians
      const currentAngle = Math.atan2(
        e.clientY - rotateInfo.centerY,
        e.clientX - rotateInfo.centerX
      );

      // Calculate the angle difference in degrees
      const angleDiff =
        (currentAngle - rotateInfo.startAngle) * (180 / Math.PI);

      // Calculate the new rotation value (rounded for consistency)
      const newRotation = Math.round(rotateInfo.currentRotation + angleDiff);

      // Log the calculated rotation for debugging
      console.log(`Rotating element ${rotateInfo.elementId}:`, {
        currentAngle,
        angleDiff,
        newRotation,
      });

      // Update the element rotation - using integer to ensure consistency
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          sceneId: rotateInfo.sceneId,
          elementId: rotateInfo.elementId,
          updates: { rotation: newRotation },
        },
      });

      // Update the start angle for the next move
      rotateInfoRef.current = {
        ...rotateInfo,
        startAngle: currentAngle,
        currentRotation: newRotation,
      };
    },
    [dispatch]
  );

  /**
   * Handle ending an element rotation operation
   */
  const handleRotateEnd = useCallback(() => {
    // Remove event listeners
    document.removeEventListener("mousemove", handleRotating);
    document.removeEventListener("mouseup", handleRotateEnd);

    // Log the final rotation
    if (rotateInfoRef.current) {
      console.log(
        `Finished rotating element ${rotateInfoRef.current.elementId}`
      );
    }

    // Clear rotate info and state
    rotateInfoRef.current = null;
    setRotatingElementId(null);

    // Remove data attribute from body
    document.body.removeAttribute("data-rotating-element-id");

    // Trigger an immediate sync to save rotation changes to the database
    dispatch({ type: "SAVE_PROJECT" });
  }, [handleRotating, dispatch]);

  /**
   * Handle element selection with improved synchronization between
   * canvas and side panel
   */
  const handleElementClick = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      console.log("Element clicked for selection:", elementId);

      // Toggle selection (if already selected, deselect)
      const newSelectedId =
        state.selectedElementId === elementId ? null : elementId;

      // Explicitly dispatch selection change to ensure it propagates properly
      dispatch({ type: "SELECT_ELEMENT", payload: newSelectedId });

      // Force focus away from any active text inputs to ensure state updates are visible
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [state.selectedElementId, dispatch]
  );

  /**
   * Handle deselecting elements when clicking on canvas background
   */
  const handleCanvasClick = useCallback(() => {
    // Only deselect if we have a selected element
    if (state.selectedElementId) {
      console.log("Canvas clicked, clearing element selection");
      dispatch({ type: "SELECT_ELEMENT", payload: null });
    }
  }, [state.selectedElementId, dispatch]);

  return {
    draggedElementId,
    resizingElementId,
    rotatingElementId,
    handleDragStart,
    handleResizeStart,
    handleRotateStart,
    handleElementClick,
    handleCanvasClick,
  };
}
