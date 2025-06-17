import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MockAuthProvider } from "./hooks/use-mock-auth";
import { ErrorBoundary } from "@/app/components/ui/error-boundary";
import { ThemeProvider } from "@/app/providers/theme-provider";
import TRPCProviderWrapper from "@/app/providers/trpc-provider";
import { Toaster } from "@/app/components/ui/toaster";
import { Suspense } from "react";
import CustomLoading from "./components/custom-loading";
import AuthCheck from "./components/auth-check";
import { checkDatabaseConnection } from "@/utils/db-check";
import { FormatProvider } from "@/app/contexts/format-context";
import { SettingsProvider } from "@/app/contexts/settings-context";
import { FontLoader } from "./components/font-loader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PMax - AI-Powered Timeline Video Editor",
  description: "Create stunning promo videos with AI assistance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FontLoader />
        <ErrorBoundary>
          <MockAuthProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              <TRPCProviderWrapper>
                <SettingsProvider>
                  <FormatProvider>
                    <Suspense fallback={<CustomLoading />}>
                      <AuthCheck>{children}</AuthCheck>
                      <Toaster />
                    </Suspense>
                  </FormatProvider>
                </SettingsProvider>
              </TRPCProviderWrapper>
            </ThemeProvider>
          </MockAuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

// Added a comment to check the main layout file
