"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import {
  Sparkles,
  Image,
  Play,
  CheckCircle,
  ArrowRight,
  Palette,
  Wand2,
  Upload,
} from "lucide-react";

interface FluxKontextDemoProps {
  onStartDemo?: () => void;
}

export default function FluxKontextDemo({ onStartDemo }: FluxKontextDemoProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const demoSteps = [
    {
      icon: Upload,
      title: "Upload or Select Image",
      description:
        "Start with any image - background, scene element, or upload new",
      action: "Choose Image",
    },
    {
      icon: Wand2,
      title: "Describe Your Edit",
      description:
        "Use natural language: 'Add sunset lighting', 'Change to cyberpunk style'",
      action: "Enter Prompt",
    },
    {
      icon: Sparkles,
      title: "AI Magic Happens",
      description: "Flux Kontext Pro processes your request with advanced AI",
      action: "Processing...",
    },
    {
      icon: CheckCircle,
      title: "Perfect Result",
      description: "Get your edited image, ready to use in your scene",
      action: "Complete!",
    },
  ];

  const features = [
    {
      icon: Palette,
      title: "Style Transfer",
      description: "Transform images to any artistic style",
      examples: ["Cyberpunk", "Vintage", "Minimalist", "Dramatic"],
    },
    {
      icon: Image,
      title: "Scene Enhancement",
      description: "Improve backgrounds and environments",
      examples: ["Lighting", "Weather", "Atmosphere", "Mood"],
    },
    {
      icon: Wand2,
      title: "Object Editing",
      description: "Modify specific elements naturally",
      examples: ["Colors", "Textures", "Shapes", "Details"],
    },
  ];

  return (
    <div className="p-6 mx-auto space-y-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-4 text-center">
        <div className="flex gap-3 justify-center items-center">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              Flux Kontext AI Editor
            </h1>
            <p className="text-muted-foreground">
              Next-generation image editing powered by advanced AI
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-center items-center">
          <Badge variant="secondary">Flux Pro Model</Badge>
          <Badge variant="secondary">Natural Language</Badge>
          <Badge variant="secondary">Real-time Results</Badge>
        </div>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Play className="w-5 h-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {demoSteps.map((step, index) => (
              <div
                key={index}
                className={`text-center space-y-3 p-4 rounded-lg border transition-all ${
                  currentStep === index
                    ? "border-purple-200 bg-purple-50"
                    : "border-border"
                }`}
              >
                <div className="flex justify-center items-center mx-auto w-12 h-12 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full">
                  <step.icon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={currentStep === index ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setCurrentStep(index)}
                >
                  {step.action}
                </Button>
                {index < demoSteps.length - 1 && (
                  <ArrowRight className="hidden mx-auto w-4 h-4 text-muted-foreground md:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {features.map((feature, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="flex gap-2 items-center text-lg">
                <feature.icon className="w-5 h-5 text-purple-600" />
                {feature.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {feature.examples.map((example, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {example}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Integration Points */}
      <Card>
        <CardHeader>
          <CardTitle>Where to Find Flux Kontext</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="flex gap-2 items-center font-medium">
                <Image className="w-4 h-4" />
                Image Elements
              </h4>
              <p className="text-sm text-muted-foreground">
                Select any image element to access Flux Kontext editing tools in
                the properties panel.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="flex gap-2 items-center font-medium">
                <Palette className="w-4 h-4" />
                Scene Backgrounds
              </h4>
              <p className="text-sm text-muted-foreground">
                Edit scene backgrounds in the Scene panel with the new
                &quot;Flux Edit&quot; tab.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="flex gap-2 items-center font-medium">
                <Sparkles className="w-4 h-4" />
                Quick Access Toolbar
              </h4>
              <p className="text-sm text-muted-foreground">
                Use the Flux Kontext button in the main toolbar for quick access
                to all features.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="flex gap-2 items-center font-medium">
                <Wand2 className="w-4 h-4" />
                Floating Editor
              </h4>
              <p className="text-sm text-muted-foreground">
                Hover over image elements to see the floating Flux Kontext
                quick-edit overlay.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="space-y-4 text-center">
        <Separator />
        <div>
          <h3 className="mb-2 text-xl font-semibold">
            Ready to Transform Your Images?
          </h3>
          <p className="mb-4 text-muted-foreground">
            Start creating stunning visuals with AI-powered image editing
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            onClick={onStartDemo}
          >
            <Sparkles className="mr-2 w-5 h-5" />
            Start Using Flux Kontext
          </Button>
        </div>
      </div>
    </div>
  );
}
