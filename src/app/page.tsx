"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navigation from "@/app/components/landing/navigation";
import HeroSection from "@/app/components/landing/hero-section";
import { LoadingSpinner } from "@/app/components/ui/loading-spinner";

export default function Home() {
  const { user, isLoaded } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const clerk = useClerk();

  useEffect(() => {
    // Set loading to false after component mounts
    setIsLoading(false);

    // If user is already signed in, redirect to dashboard
    // Only redirect if we're actually loaded and have a user
    if (isLoaded && user) {
      // Use replace to avoid back button issues
      router.replace("/dashboard");
    }
  }, [isLoaded, user, router]);
  
  // Function to clear all sessions and cookies
  const handleClearSession = async () => {
    try {
      // Sign out from Clerk
      await clerk.signOut();
      
      // Clear all cookies on client side
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error("Error clearing session:", error);
      // Force reload anyway
      window.location.reload();
    }
  };

  // Show loading spinner during initial load or auth check
  if (isLoading || !isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" variant="gradient" />
      </div>
    );
  }

  // Show landing page for non-authenticated users
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <HeroSection />
        {/* Debug button for session issues - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={handleClearSession}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Clear Session (Debug)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
