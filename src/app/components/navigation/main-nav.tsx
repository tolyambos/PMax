"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Menu,
  X,
  Video,
  Sparkles,
  User,
  FolderOpen,
  Shield,
  Settings,
  Crown,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ThemeToggle } from "@/app/components/theme-toggle";

const baseNavItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Projects", href: "/projects" },
];

export default function MainNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [canCreateProjects, setCanCreateProjects] = useState(false);
  const [navItems, setNavItems] = useState(baseNavItems);
  const { user, isLoaded } = useUser();
  const { isAdmin } = useIsAdmin();
  const { signOut } = useClerk();
  const router = useRouter();

  const isSignedIn = isLoaded && !!user;

  useEffect(() => {
    if (!isSignedIn) return;

    const checkPermissions = async () => {
      try {
        const response = await fetch("/api/projects/can-create");
        const data = await response.json();
        
        if (data.success && data.canCreate) {
          setCanCreateProjects(true);
          setNavItems([...baseNavItems, { name: "Create", href: "/wizard" }]);
        } else {
          setCanCreateProjects(false);
          setNavItems(baseNavItems);
        }
      } catch (err) {
        setCanCreateProjects(false);
        setNavItems(baseNavItems);
      }
    };

    checkPermissions();
  }, [isSignedIn]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to homepage landing page
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
      // Still redirect to homepage even if there's an error
      router.push("/");
    }
  };

  return (
    <motion.header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <nav className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          {/* Logo */}
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <div className="relative">
              <Video className="h-6 w-6 text-primary" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 animate-pulse text-accent" />
            </div>
            <span className="hidden font-bold sm:inline-block">PMax</span>
            <Badge variant="secondary" className="text-xs">
              AI
            </Badge>
          </Link>

          {/* Desktop Navigation */}
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile Logo */}
        <Link
          href="/dashboard"
          className="mr-6 flex items-center space-x-2 md:hidden"
        >
          <div className="relative">
            <Video className="h-6 w-6 text-primary" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 animate-pulse text-accent" />
          </div>
          <span className="font-bold">PMax</span>
        </Link>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          {/* Right side items */}
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search could go here if needed */}
          </div>

          <nav className="flex items-center">
            {isSignedIn && (
              <div className="hidden md:flex items-center space-x-2 mr-4">
                {/* User info */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {user?.firstName?.[0] ||
                          user?.emailAddresses[0]?.emailAddress?.[0] ||
                          "U"}
                      </span>
                    </div>
                    {isAdmin && (
                      <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" />
                    )}
                  </div>
                  <span className="text-sm font-medium hidden lg:block">
                    {user?.firstName || "User"}
                  </span>
                </div>

                {/* Action buttons */}
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/projects">
                    <FolderOpen className="mr-2 w-4 h-4" />
                    Projects
                  </Link>
                </Button>

                {isAdmin && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 w-4 h-4" />
                      Admin
                    </Link>
                  </Button>
                )}

                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings">
                    <Settings className="w-4 h-4" />
                  </Link>
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}

            <ThemeToggle />

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </nav>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            className="absolute top-14 left-0 right-0 z-50 p-4 shadow-lg md:hidden bg-background border-b"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-4">
              {/* Navigation Links */}
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block py-2 text-sm transition-colors hover:text-foreground/80 text-foreground/60"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {isSignedIn && (
                <>
                  {/* Divider */}
                  <div className="my-4 border-t border-border" />

                  {/* User Section */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {user?.firstName?.[0] ||
                              user?.emailAddresses[0]?.emailAddress?.[0] ||
                              "U"}
                          </span>
                        </div>
                        {isAdmin && (
                          <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {user?.firstName || "User"}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      asChild
                    >
                      <Link href="/projects">
                        <FolderOpen className="mr-2 w-4 h-4" />
                        Projects
                      </Link>
                    </Button>

                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        asChild
                      >
                        <Link href="/admin">
                          <Shield className="mr-2 w-4 h-4" />
                          Admin
                        </Link>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      asChild
                    >
                      <Link href="/settings">
                        <Settings className="mr-2 w-4 h-4" />
                        Settings
                      </Link>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 w-4 h-4" />
                      Sign Out
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
}
