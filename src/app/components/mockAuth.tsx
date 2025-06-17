"use client";

import { createContext, useContext, useState, useEffect } from "react";

// Mock auth context
type AuthContextType = {
  userId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoaded: boolean;
};

const AuthContext = createContext<AuthContextType>({
  userId: null,
  signIn: async () => {},
  signOut: async () => {},
  isLoaded: false,
});

// Mock auth provider for development
export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check for auth state from multiple sources
    const getCookieValue = (name: string) => {
      const match = document.cookie.match(
        new RegExp("(^| )" + name + "=([^;]+)")
      );
      return match ? match[2] : null;
    };

    // Try cookie first
    const cookieUserId = getCookieValue("mockUserId");
    if (cookieUserId) {
      setUserId(cookieUserId);
      // Also update localStorage for backwards compatibility
      localStorage.setItem("mockUserId", cookieUserId);
      console.log("Loaded auth from cookie:", cookieUserId);
    } else {
      // Fall back to localStorage
      const savedUserId = localStorage.getItem("mockUserId");
      if (savedUserId) {
        setUserId(savedUserId);
        // Set cookie for server-side auth
        document.cookie = `mockUserId=${savedUserId}; path=/; max-age=2592000`; // 30 days
        console.log("Loaded auth from localStorage:", savedUserId);
      }
    }

    // Check if we have a regular mockUser object in localStorage (from old login flow)
    try {
      const mockUserJson = localStorage.getItem("mockUser");
      if (mockUserJson && !userId) {
        const mockUser = JSON.parse(mockUserJson);
        if (mockUser.id) {
          setUserId(mockUser.id);
          // Set cookie and localStorage for future use
          document.cookie = `mockUserId=${mockUser.id}; path=/; max-age=2592000`;
          localStorage.setItem("mockUserId", mockUser.id);
          console.log("Migrated auth from old mockUser:", mockUser.id);
        }
      }
    } catch (e) {
      console.error("Error parsing mockUser:", e);
    }

    setIsLoaded(true);
  }, [userId]);

  const signIn = async (email: string, password: string) => {
    // Mock sign in
    const mockUserId = "user-123";
    setUserId(mockUserId);

    // Store in localStorage for client-side
    localStorage.setItem("mockUserId", mockUserId);

    // Create a mock user record in DB if it doesn't exist
    try {
      // Use fetch to call our API endpoint
      const response = await fetch("/api/mock-auth/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: mockUserId,
          email: email || "user@example.com",
          name: "Mock User",
        }),
      });

      if (!response.ok) {
        console.error("Failed to create mock user");
      }

      // Set a cookie for server-side auth
      document.cookie = `mockUserId=${mockUserId}; path=/; max-age=2592000`; // 30 days
    } catch (error) {
      console.error("Error during mock sign in:", error);
    }
  };

  const signOut = async () => {
    setUserId(null);
    localStorage.removeItem("mockUserId");

    // Clear the cookie
    document.cookie = "mockUserId=; path=/; max-age=0";
  };

  return (
    <AuthContext.Provider value={{ userId, signIn, signOut, isLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use mock auth
export function useMockAuth() {
  return useContext(AuthContext);
}
