"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type AnimationProvider = "runway" | "bytedance";

interface SettingsContextType {
  animationProvider: AnimationProvider;
  setAnimationProvider: (provider: AnimationProvider) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [animationProvider, setAnimationProvider] =
    useState<AnimationProvider>("bytedance");

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("pmax_animation_provider");
    if (saved && (saved === "runway" || saved === "bytedance")) {
      setAnimationProvider(saved);
    }
  }, []);

  // Save settings to localStorage when changed
  const handleSetAnimationProvider = (provider: AnimationProvider) => {
    setAnimationProvider(provider);
    localStorage.setItem("pmax_animation_provider", provider);
  };

  return (
    <SettingsContext.Provider
      value={{
        animationProvider,
        setAnimationProvider: handleSetAnimationProvider,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
