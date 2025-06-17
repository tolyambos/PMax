"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryClass extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const handleRefresh = () => {
    resetError();
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex justify-center items-center p-4 min-h-screen bg-gradient-to-br from-background via-background to-destructive/5">
      {/* Background Effects */}
      <div className="overflow-hidden absolute inset-0">
        <motion.div
          className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl bg-destructive/10"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <motion.div
              className="p-3 mx-auto mb-4 rounded-full bg-destructive/10"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </motion.div>

            <CardTitle className="text-xl font-semibold">
              Oops! Something went wrong
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              We encountered an unexpected error. This has been logged and
              we&apos;ll look into it.
            </p>

            {process.env.NODE_ENV === "development" && error && (
              <details className="mt-4">
                <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                  Error Details (Development)
                </summary>
                <pre className="overflow-auto p-3 mt-2 max-h-32 text-xs rounded-md bg-muted">
                  {error.stack || error.message}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button
                onClick={handleRefresh}
                className="flex-1"
                variant="outline"
              >
                <RefreshCw className="mr-2 w-4 h-4" />
                Try Again
              </Button>

              <Button
                onClick={handleGoHome}
                className="flex-1 bg-gradient-primary text-primary-foreground"
              >
                <Home className="mr-2 w-4 h-4" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export const ErrorBoundary = ErrorBoundaryClass;
