"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navigation from "@/app/components/landing/navigation";
import HeroSection from "@/app/components/landing/hero-section";
import { LoadingSpinner } from "@/app/components/ui/loading-spinner";

export default function Home() {
  const { user, isLoaded } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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
        {/* Additional sections can be added here */}
      </main>
    </div>
  );
}
