"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Menu, X, Video, Sparkles, User, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { ThemeToggle } from "@/app/components/theme-toggle";

const navItems = [
  { name: "Features", href: "#features" },
  { name: "Templates", href: "#templates" },
  { name: "Pricing", href: "#pricing" },
  { name: "About", href: "#about" },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const isSignedIn = isLoaded && !!user;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "shadow-lg glass-effect" : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <nav className="container px-4 py-4 mx-auto">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <Video className="w-8 h-8 transition-transform text-primary group-hover:scale-110" />
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 animate-pulse text-accent" />
            </div>
            <span className="text-2xl font-bold text-gradient">PMax</span>
            <Badge variant="secondary" className="text-xs">
              AI
            </Badge>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="relative transition-colors text-foreground/80 hover:text-foreground group"
              >
                {item.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-primary group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </div>

          {/* Auth Buttons / User Menu */}
          <div className="hidden items-center space-x-4 md:flex">
            <ThemeToggle />

            {isSignedIn ? (
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard">
                    <User className="mr-2 w-4 h-4" />
                    Dashboard
                  </Link>
                </Button>
                <div className="flex items-center space-x-2">
                  {user?.imageUrl && (
                    <img
                      src={user.imageUrl}
                      alt={user.firstName || "User"}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium">{user?.firstName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signOut()}
                    className="ml-2"
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sign-in">
                    <LogIn className="mr-2 w-4 h-4" />
                    Sign In
                  </Link>
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-primary text-primary-foreground"
                  asChild
                >
                  <Link href="/sign-up">
                    <UserPlus className="mr-2 w-4 h-4" />
                    Get Started
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            className="p-4 mt-4 rounded-lg md:hidden glass-effect"
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
                  className="block py-2 transition-colors text-foreground/80 hover:text-foreground"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Divider */}
              <div className="my-4 border-t border-border" />

              {/* Auth Section */}
              {isSignedIn ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    {user?.imageUrl && (
                      <img
                        src={user.imageUrl}
                        alt={user.firstName || "User"}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium">
                      {user?.firstName}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href="/dashboard">
                      <User className="mr-2 w-4 h-4" />
                      Dashboard
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href="/sign-in">
                      <LogIn className="mr-2 w-4 h-4" />
                      Sign In
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="w-full bg-gradient-primary text-primary-foreground"
                    asChild
                  >
                    <Link href="/sign-up">
                      <UserPlus className="mr-2 w-4 h-4" />
                      Get Started
                    </Link>
                  </Button>
                </div>
              )}

              {/* Theme Toggle */}
              <div className="flex justify-center pt-2">
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
}
