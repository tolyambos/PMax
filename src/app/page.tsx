"use client";

import { useAuth } from "@/app/hooks/use-mock-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navigation from "@/app/components/landing/navigation";
import HeroSection from "@/app/components/landing/hero-section";
import { LoadingSpinner } from "@/app/components/ui/loading-spinner";

export default function Home() {
  const { data: session, status } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Set loading to false after component mounts
    setIsLoading(false);

    // If user is already signed in, redirect to dashboard
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Show loading spinner during initial load or auth check
  if (isLoading || status === "loading") {
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
