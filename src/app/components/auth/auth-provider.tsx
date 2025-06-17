"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  email?: string;
  name?: string;
  imageUrl?: string;
  firstName?: string;
  fullName?: string;
}

interface AuthContextType {
  isSignedIn: boolean;
  user: User | null;
  isLoaded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  user: null,
  isLoaded: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthContextType>({
    isSignedIn: false,
    user: null,
    isLoaded: false,
  });

  useEffect(() => {
    // Check for development mode fallback user
    if (process.env.NODE_ENV === "development") {
      // Check localStorage for mock user session
      const mockUser = localStorage.getItem("mock_user");
      if (mockUser) {
        try {
          const user = JSON.parse(mockUser);
          setAuthState({
            isSignedIn: true,
            user,
            isLoaded: true,
          });
          return;
        } catch (error) {
          console.error("Error parsing mock user:", error);
        }
      }
    }

    // Default to not signed in
    setAuthState({
      isSignedIn: false,
      user: null,
      isLoaded: true,
    });
  }, []);

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}
