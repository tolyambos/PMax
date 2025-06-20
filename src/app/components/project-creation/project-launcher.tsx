"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Wand2,
  Video,
  Sparkles,
  ArrowRight,
  Play,
  Zap,
  Target,
  Palette,
  Clock,
} from "lucide-react";
import ProjectWizard from "./project-wizard";

const QUICK_START_OPTIONS = [
  {
    id: "ai-wizard",
    title: "AI Video Wizard",
    description: "Let AI create your entire video ad from a simple prompt",
    icon: Wand2,
    gradient: "from-purple-500 to-blue-600",
    features: [
      "Smart template selection",
      "Auto scene generation",
      "Professional styling",
    ],
    time: "2 minutes",
    popular: true,
  },
  {
    id: "template-starter",
    title: "Template Starter",
    description: "Choose from professionally designed video templates",
    icon: Palette,
    gradient: "from-green-500 to-emerald-600",
    features: ["Pre-built scenes", "Easy customization", "Industry-specific"],
    time: "5 minutes",
    popular: false,
  },
  {
    id: "blank-project",
    title: "Blank Canvas",
    description: "Start from scratch with complete creative control",
    icon: Video,
    gradient: "from-orange-500 to-red-600",
    features: [
      "Full customization",
      "Manual scene creation",
      "Advanced controls",
    ],
    time: "15+ minutes",
    popular: false,
  },
];

const FEATURES_SHOWCASE = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Generate professional video ads in under 60 seconds",
  },
  {
    icon: Target,
    title: "Smart Targeting",
    description: "AI optimizes content for your specific audience and platform",
  },
  {
    icon: Sparkles,
    title: "Premium Quality",
    description: "Cinema-grade visuals with professional styling and effects",
  },
  {
    icon: Clock,
    title: "Always Current",
    description: "Templates and styles updated with latest design trends",
  },
];

interface ProjectLauncherProps {
  onProjectSelect?: (projectId: string) => void;
}

export default function ProjectLauncher({
  onProjectSelect,
}: ProjectLauncherProps) {
  const [currentView, setCurrentView] = useState<"launcher" | "wizard">(
    "launcher"
  );
  const [selectedStarterType, setSelectedStarterType] = useState<string>("");

  const handleQuickStart = (optionId: string) => {
    setSelectedStarterType(optionId);
    if (optionId === "ai-wizard") {
      setCurrentView("wizard");
    } else {
      // For now, all options lead to wizard
      // In future, could have different flows for templates vs blank canvas
      setCurrentView("wizard");
    }
  };

  const handleWizardComplete = (projectData: any) => {
    // Navigate to editor with new project
    console.log("ProjectLauncher received project data:", projectData);
    const projectId = projectData?.id || projectData?.projectId;
    if (onProjectSelect && projectData && projectId) {
      console.log("ProjectLauncher redirecting to:", projectId);
      onProjectSelect(projectId);
    } else {
      console.error(
        "ProjectLauncher: Invalid project data or missing projectId:",
        projectData
      );
    }
  };

  if (currentView === "wizard") {
    return (
      <ProjectWizard
        onComplete={handleWizardComplete}
        onCancel={() => setCurrentView("launcher")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8 mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="flex justify-center items-center mx-auto mb-6 w-20 h-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>

            <h1 className="mb-4 text-5xl font-bold text-foreground">
              Create Stunning Video Ads
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Transform your ideas into professional video advertisements with
              the power of AI. No design experience required.
            </p>
          </div>

          <div className="flex flex-col gap-4 justify-center mb-8 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="px-8 py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:text-white"
            >
              <Link href="/wizard">
                <Wand2 className="mr-2 w-5 h-5 dark:text-white" />
                Start Creating Now
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              asChild
              className="px-8 py-6 text-lg"
            >
              <Link href="/projects">
                <Video className="mr-2 w-5 h-5" />
                View My Projects
              </Link>
            </Button>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-8 justify-center text-sm text-muted-foreground">
            <div className="flex gap-2 items-center">
              <Clock className="w-4 h-4" />
              <span>Videos ready in 60 seconds</span>
            </div>
            <div className="flex gap-2 items-center">
              <Sparkles className="w-4 h-4" />
              <span>AI-powered creativity</span>
            </div>
            <div className="flex gap-2 items-center">
              <Target className="w-4 h-4" />
              <span>Platform optimized</span>
            </div>
          </div>
        </motion.div>

        {/* Quick Start Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold text-center text-foreground">
            Choose Your Starting Point
          </h2>

          <div className="grid grid-cols-1 gap-6 mx-auto max-w-6xl md:grid-cols-3">
            {QUICK_START_OPTIONS.map((option, index) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden ${
                    option.popular ? "ring-2 ring-purple-400" : ""
                  }`}
                  onClick={() => handleQuickStart(option.id)}
                >
                  {option.popular && (
                    <div className="absolute top-0 right-0 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-l from-purple-600 to-blue-600 rounded-bl-lg">
                      Most Popular
                    </div>
                  )}

                  <CardContent className="p-6">
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-r ${option.gradient} flex items-center justify-center mb-4`}
                    >
                      <option.icon className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="mb-2 text-xl font-semibold text-foreground">
                      {option.title}
                    </h3>
                    <p className="mb-4 text-muted-foreground">
                      {option.description}
                    </p>

                    <div className="mb-4 space-y-2">
                      {option.features.map((feature, featureIndex) => (
                        <div
                          key={featureIndex}
                          className="flex gap-2 items-center text-sm text-foreground"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex gap-1 items-center text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {option.time}
                      </span>
                      <ArrowRight className="w-5 h-5 transition-colors text-muted-foreground group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Features Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold text-center text-foreground">
            Why Choose PMax AI?
          </h2>

          <div className="grid grid-cols-1 gap-6 mx-auto max-w-6xl md:grid-cols-2 lg:grid-cols-4">
            {FEATURES_SHOWCASE.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="text-center"
              >
                <div className="flex justify-center items-center mx-auto mb-4 w-12 h-12 rounded-full bg-muted">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Projects Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <h2 className="mb-4 text-2xl font-bold text-foreground">
            Ready to Create Something Amazing?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Join thousands of creators who&apos;ve made stunning video ads with
            PMax AI
          </p>

          <div className="flex flex-col gap-4 justify-center sm:flex-row">
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:text-white"
            >
              <Link href="/wizard">
                <Wand2 className="mr-2 w-5 h-5 dark:text-white" />
                Create Your First Video
              </Link>
            </Button>

            <Button variant="outline" size="lg" asChild>
              <Link href="/projects">
                <Play className="mr-2 w-5 h-5 dark:text-white" />
                View Projects
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
