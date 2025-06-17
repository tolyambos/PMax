"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Import centralized video formats
import { VIDEO_FORMATS, type VideoFormat } from "@/app/utils/video-dimensions";

// Re-export for components that import from this file
export { VIDEO_FORMATS, type VideoFormat };

interface FormatContextType {
  currentFormat: VideoFormat;
  setFormat: (format: VideoFormat) => void;
  formatDetails: (typeof VIDEO_FORMATS)[VideoFormat];
}

const FormatContext = createContext<FormatContextType | undefined>(undefined);

export function FormatProvider({
  children,
  initialFormat,
}: {
  children: ReactNode;
  initialFormat?: VideoFormat;
}) {
  const [currentFormat, setCurrentFormat] = useState<VideoFormat>(
    initialFormat || "9:16"
  );

  // Get format details based on current selection
  const formatDetails = VIDEO_FORMATS[currentFormat];

  // Update local storage when format changes
  useEffect(() => {
    localStorage.setItem("pmax_video_format", currentFormat);
  }, [currentFormat]);

  // Update current format when initialFormat changes
  useEffect(() => {
    if (initialFormat && VIDEO_FORMATS[initialFormat]) {
      setCurrentFormat(initialFormat);
    }
  }, [initialFormat]);

  // Load saved format on initial render (only if no initialFormat provided)
  useEffect(() => {
    if (!initialFormat) {
      const savedFormat = localStorage.getItem(
        "pmax_video_format"
      ) as VideoFormat;
      if (savedFormat && VIDEO_FORMATS[savedFormat]) {
        setCurrentFormat(savedFormat);
      }
    }
  }, [initialFormat]);

  const setFormat = (format: VideoFormat) => {
    if (VIDEO_FORMATS[format]) {
      setCurrentFormat(format);
    }
  };

  return (
    <FormatContext.Provider value={{ currentFormat, setFormat, formatDetails }}>
      {children}
    </FormatContext.Provider>
  );
}

export function useVideoFormat() {
  const context = useContext(FormatContext);
  if (context === undefined) {
    throw new Error("useVideoFormat must be used within a FormatProvider");
  }
  return context;
}
