"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Play,
  Sparkles,
  Video,
  Zap,
  ArrowRight,
  CheckCircle,
  Star,
  Users,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Videos Created", value: "10K+", icon: Video },
  { label: "Happy Users", value: "2.5K+", icon: Users },
  { label: "Time Saved", value: "500h+", icon: TrendingUp },
];

const features = [
  "AI-Powered Scene Generation",
  "Smart Animation Engine",
  "Professional Templates",
  "Real-time Collaboration",
  "Export in Multiple Formats",
  "Advanced Editor Tools",
];

export default function HeroSection() {
  const [currentFeature, setCurrentFeature] = useState(0);
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    if (isLoaded) {
      if (isSignedIn) {
        // User is already signed in, redirect to dashboard
        router.push("/dashboard");
      } else {
        // User is not signed in, redirect to sign-up page for new users
        router.push("/sign-up");
      }
    }
  };

  return (
    <section className="flex overflow-hidden relative justify-center items-center min-h-screen">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />

      {/* Animated Background Orbs */}
      <div className="overflow-hidden absolute inset-0">
        <motion.div
          className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl bg-primary/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-1/4 bottom-1/4 w-96 h-96 rounded-full blur-3xl bg-accent/20"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* Main Content */}
      <div className="container relative z-10 px-4 py-20 mx-auto">
        <div className="mx-auto max-w-6xl">
          {/* Header Badge */}
          <motion.div
            className="flex justify-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge
              variant="secondary"
              className="px-4 py-2 text-sm font-medium bg-gradient-primary text-primary-foreground"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Powered by Advanced AI
            </Badge>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            className="space-y-6 text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">
              Create <span className="text-gradient">Stunning</span>
              <br />
              Videos with AI
            </h1>

            <p className="mx-auto max-w-3xl text-xl leading-relaxed md:text-2xl text-muted-foreground">
              Transform your ideas into professional videos in minutes. Our
              AI-powered platform handles everything from scene generation to
              animation.
            </p>
          </motion.div>

          {/* Dynamic Feature Display */}
          <motion.div
            className="my-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <p className="mb-2 text-lg text-muted-foreground">
              Currently featuring:
            </p>
            <motion.p
              key={currentFeature}
              className="text-2xl font-semibold text-primary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {features[currentFeature]}
            </motion.p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col gap-4 justify-center items-center mt-12 sm:flex-row"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <Button
              size="lg"
              className="px-8 py-4 text-lg transition-all duration-300 group bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={handleGetStarted}
            >
              {isSignedIn ? "Go to Dashboard" : "Start Creating for Free"}
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="px-8 py-4 text-lg group"
              asChild
            >
              <Link href="#demo">
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </Link>
            </Button>
          </motion.div>

          {/* Feature List */}
          <motion.div
            className="grid grid-cols-2 gap-4 mx-auto mt-16 max-w-2xl md:grid-cols-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {features.slice(0, 6).map((feature, index) => (
              <div
                key={feature}
                className="flex items-center space-x-2 text-sm"
              >
                <CheckCircle className="flex-shrink-0 w-4 h-4 text-accent" />
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-1 gap-8 mx-auto mt-20 max-w-4xl md:grid-cols-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="p-6 text-center rounded-xl glass-effect"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <stat.icon className="mx-auto mb-4 w-8 h-8 text-primary" />
                <div className="mb-2 text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Social Proof */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Trusted by creators worldwide
            </p>
            <div className="flex justify-center items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-5 h-5 text-yellow-400 fill-yellow-400"
                />
              ))}
              <span className="ml-2 text-sm font-medium">
                4.9/5 from 1,200+ reviews
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
      >
        <motion.div
          className="flex justify-center w-6 h-10 rounded-full border-2 border-muted-foreground"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="mt-2 w-1 h-3 rounded-full bg-muted-foreground"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
