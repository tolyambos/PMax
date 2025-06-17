"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For development, just simulate a successful login
      localStorage.setItem(
        "devUser",
        JSON.stringify({
          id: "dev-user-id",
          name: "Development User",
          email: email || "dev@example.com",
        })
      );

      toast({
        title: "Logged in successfully",
        description: "Welcome to PMax!",
      });

      // Redirect to home
      router.push("/");
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Error logging in",
        description: "Please try again.",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center px-4 min-h-screen bg-muted/40">
      <div className="p-8 space-y-8 w-full max-w-md rounded-lg border shadow-sm bg-card">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In to PMax</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 mt-1 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3 py-2 mt-1 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </div>

          <div className="pt-2 text-sm text-center">
            <p className="text-muted-foreground">
              For development, any email/password will work
            </p>
          </div>
        </form>

        <div className="mt-4 text-sm text-center">
          <p>
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
