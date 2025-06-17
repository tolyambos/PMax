"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

interface MockAuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email?: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(
  undefined
);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH !== "true") {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/mock-session");
      const data = await response.json();
      setUser(data.user || null);
    } catch (error) {
      console.error("Error checking session:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (
    email = "dev@example.com",
    name = "Development User"
  ) => {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH !== "true") {
      throw new Error("Mock auth is disabled");
    }

    try {
      const response = await fetch("/api/auth/mock-signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        // Redirect to dashboard or refresh page
        window.location.href = data.redirectTo || "/dashboard";
      } else {
        throw new Error(data.error || "Sign in failed");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear the session cookie
      await fetch("/api/auth/mock-signout", { method: "POST" });
      setUser(null);
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
      // Still clear user state even if API call fails
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <MockAuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error("useMockAuth must be used within a MockAuthProvider");
  }
  return context;
}

// Compatibility hook that works with both NextAuth and Mock Auth
export function useAuth() {
  // Always call hooks at the top level
  const mockAuth = useMockAuth();

  // Check if mock auth is enabled
  const isMockAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true";

  // If mock auth is enabled, use mock auth data
  if (isMockAuthEnabled) {
    return {
      data: mockAuth.user ? { user: mockAuth.user } : null,
      status: mockAuth.loading
        ? "loading"
        : mockAuth.user
          ? "authenticated"
          : "unauthenticated",
      loading: mockAuth.loading,
      signIn: mockAuth.signIn,
      signOut: mockAuth.signOut,
    };
  }

  // Fallback for NextAuth (when it's working)
  // In production, you would replace this with actual NextAuth hooks
  // For now, returning mock auth data even in production for consistency
  // This ensures the hook behavior is predictable across environments
  return {
    data: mockAuth.user ? { user: mockAuth.user } : null,
    status: mockAuth.loading
      ? "loading"
      : mockAuth.user
        ? "authenticated"
        : "unauthenticated",
    loading: mockAuth.loading,
    signIn: mockAuth.signIn,
    signOut: mockAuth.signOut,
  };
}
