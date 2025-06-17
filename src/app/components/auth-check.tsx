"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import CustomLoading from "./custom-loading";

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // For development, always allow access
    if (process.env.NODE_ENV === "development") {
      setIsLoading(false);
      return;
    }

    // In production, implement actual auth checks here
    // For now, just allow access to everything
    setIsLoading(false);
  }, [pathname, router]);

  if (isLoading) {
    return <CustomLoading />;
  }

  return <>{children}</>;
}
