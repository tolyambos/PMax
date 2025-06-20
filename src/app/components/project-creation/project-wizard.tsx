"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent } from "@/app/components/ui/card";
import { Slider } from "@/app/components/ui/slider";
import { Switch } from "@/app/components/ui/switch";
import { useToast } from "@/app/components/ui/use-toast";
import { useProjectGeneration } from "@/app/hooks/use-project-generation";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Video,
  Clock,
  Target,
  Palette,
  Wand2,
  Check,
  Play,
  Eye,
  ChevronRight,
  Upload,
  ImageIcon,
  Zap,
  CheckCircle,
  Clapperboard,
  X,
  Loader2,
  Film,
  Package,
  Building2,
  Smartphone,
  Monitor,
  Square,
  RectangleVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// Project templates with modern categories mapped to API adType
const PROJECT_TEMPLATES = [
  {
    id: "product-video",
    name: "Product Video",
    description: "Showcase specific products with compelling visuals",
    thumbnail: "📦",
    gradient: "from-blue-500 via-purple-500 to-indigo-600",
    tags: ["Product", "Showcase", "Commercial"],
    example: "Luxury watches, iPhone, Tesla, fashion items, tech gadgets",
    adType: "product",
  },
  {
    id: "category-video",
    name: "Category Video",
    description: "Promote product categories or brand lifestyle",
    thumbnail: "🏢",
    gradient: "from-green-400 via-emerald-500 to-teal-600",
    tags: ["Category", "Lifestyle", "Brand"],
    example: "Wellness brands, food categories, fashion collections, services",
    adType: "brand",
  },
];

// Format options with aspect ratios
const FORMATS = [
  {
    value: "9:16",
    name: "Stories",
    description: "TikTok, Instagram Stories",
    dimensions: "1080×1920",
    icon: Smartphone,
    popular: true,
  },
  {
    value: "16:9",
    name: "YouTube",
    description: "YouTube, TV, presentations",
    dimensions: "1920×1080",
    icon: Monitor,
    popular: true,
  },
  {
    value: "1:1",
    name: "Square",
    description: "Instagram feed, Facebook",
    dimensions: "1080×1080",
    icon: Square,
    popular: false,
  },
  {
    value: "4:5",
    name: "Portrait",
    description: "Instagram posts",
    dimensions: "1080×1350",
    icon: RectangleVertical,
    popular: false,
  },
];

// Visual styles with previews
const STYLES = [
  {
    value: "cinematic",
    name: "Cinematic",
    description: "Film-like quality with dramatic lighting",
    preview: "🎬",
    mood: "Premium, dramatic",
  },
  {
    value: "realistic",
    name: "Realistic",
    description: "True-to-life with natural lighting",
    preview: "📸",
    mood: "Authentic, natural",
  },
  {
    value: "minimalist",
    name: "Minimalist",
    description: "Clean, simple, focused design",
    preview: "⚪",
    mood: "Clean, modern",
  },
  {
    value: "vibrant",
    name: "Vibrant",
    description: "Bold colors and dynamic energy",
    preview: "🌈",
    mood: "Energetic, bold",
  },
];

interface ProjectWizardProps {
  onComplete: (projectData: any) => void;
  onCancel: () => void;
}

export default function ProjectWizard({
  onComplete,
  onCancel,
}: ProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [projectData, setProjectData] = useState({
    template: "",
    name: "",
    description: "",
    adType: "",
    productName: "",
    targetAudience: "",
    keyPoints: "",
    format: "9:16",
    style: "cinematic",
    totalDuration: 9, // 3 scenes × 3 seconds average
    numScenes: 3,
    // Animation settings - default to true for better user experience
    animateAllScenes: true,
    animationProvider: "bytedance" as "bytedance" | "runway",
    // New fields for product upload
    productImages: [] as Array<{
      url: string;
      displayUrl: string;
      file: File;
      visionAnalysis: string;
    }>,
    isUploadingProduct: false,
    uploadingImageIndex: -1,
  });
  const { toast } = useToast();
  const {
    isGenerating,
    progress,
    error,
    timedOut,
    generateProject,
    checkStatus,
    reset,
  } = useProjectGeneration();

  // Dynamic steps based on template selection
  const getSteps = () => {
    const baseSteps = [
      { id: "template", title: "Choose Template", icon: Palette },
    ];

    if (projectData.template === "product-video") {
      return [
        ...baseSteps,
        { id: "product-upload", title: "Upload Product", icon: Upload },
        { id: "details", title: "Project Details", icon: Video },
        { id: "format", title: "Format & Style", icon: Target },
        { id: "preview", title: "Review & Generate", icon: Eye },
      ];
    }

    // Category video or other templates use simplified flow
    return [
      ...baseSteps,
      { id: "details", title: "Project Details", icon: Video },
      { id: "format", title: "Format & Style", icon: Target },
      { id: "preview", title: "Review & Generate", icon: Eye },
    ];
  };

  const steps = getSteps();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Product image upload handler for single image
  const handleProductImageUpload = async (file: File, index?: number) => {
    if (projectData.productImages.length >= 1 && index === undefined) {
      toast({
        variant: "destructive",
        title: "Maximum images reached",
        description: "You can upload 1 product image for AI generation.",
      });
      return;
    }

    const currentIndex =
      index !== undefined ? index : projectData.productImages.length;
    setProjectData({
      ...projectData,
      isUploadingProduct: true,
      uploadingImageIndex: currentIndex,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload product image");
      }

      const result = await response.json();

      // Analyze product with vision API
      console.log(`Analyzing product image ${currentIndex + 1} with vision...`);
      const visionResponse = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: result.url,
          prompt: `Analyze this product image. Describe the product, its key features, colors, style, materials, and what makes it appealing. Include details about lighting, composition, and any unique characteristics that would be important for creating a compelling advertisement.`,
        }),
      });

      if (!visionResponse.ok) {
        throw new Error("Failed to analyze product image");
      }

      const visionResult = await visionResponse.json();

      // Generate presigned URL for frontend display
      let displayUrl = result.url;
      try {
        const refreshResponse = await fetch("/api/s3/presigned-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: result.url }),
        });

        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json();
          displayUrl = refreshResult.presignedUrl;
          console.log(
            `Generated presigned URL for product image ${currentIndex + 1}`
          );
        } else {
          console.warn(
            "Failed to generate presigned URL for display, using original"
          );
        }
      } catch (refreshError) {
        console.warn(
          "Error generating presigned URL for display:",
          refreshError
        );
      }

      const newImage = {
        url: result.url,
        displayUrl: displayUrl,
        file: file,
        visionAnalysis: visionResult.description || "",
      };

      const updatedImages = [...projectData.productImages];
      if (index !== undefined) {
        // Replace existing image
        updatedImages[index] = newImage;
      } else {
        // Add new image
        updatedImages.push(newImage);
      }

      setProjectData({
        ...projectData,
        productImages: updatedImages,
        isUploadingProduct: false,
        uploadingImageIndex: -1,
      });

      toast({
        title: `Product image uploaded! 📸`,
        description:
          "AI has analyzed your product image and will create scenes featuring it.",
      });
    } catch (error) {
      console.error("Product upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setProjectData({
        ...projectData,
        isUploadingProduct: false,
        uploadingImageIndex: -1,
      });
    }
  };

  // Remove product image handler
  const handleRemoveProductImage = (index: number) => {
    const updatedImages = projectData.productImages.filter(
      (_, i) => i !== index
    );
    setProjectData({
      ...projectData,
      productImages: updatedImages,
    });

    toast({
      title: "Image removed",
      description: `Product image has been removed.`,
    });
  };

  const handleGenerate = async () => {
    // Debug log to check animation settings
    console.log("Project generation data:", {
      template: projectData.template,
      adType: projectData.adType,
      animateAllScenes: projectData.animateAllScenes,
      animationProvider: projectData.animationProvider,
      isProductVideo: projectData.template === "product-video",
    });

    try {
      const requestData = {
        name: projectData.name,
        description: projectData.description || undefined,
        adType: projectData.adType,
        productName: projectData.productName,
        targetAudience: projectData.targetAudience || undefined,
        keyPoints: projectData.description, // Using description as the comprehensive brief
        format: projectData.format,
        style: projectData.style,
        numScenes: projectData.numScenes,
        totalDuration: projectData.totalDuration,
        // Animation settings
        animateAllScenes: projectData.animateAllScenes,
        animationProvider: projectData.animationProvider,
        // Product-specific data
        productImages:
          projectData.productImages.length > 0
            ? projectData.productImages.map((img) => ({
                url: img.url,
                visionAnalysis: img.visionAnalysis,
              }))
            : undefined,
        isProductVideo: projectData.template === "product-video",
      };

      const result = await generateProject(requestData);
      console.log("Wizard received API result:", result);
      onComplete(result);
      toast({
        title: "Project Created! 🎉",
        description: "Your AI-powered video ad is being generated...",
      });
    } catch (error) {
      console.error("Project generation error:", error);
      if (!timedOut) {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description:
            error instanceof Error
              ? error.message
              : "Please try again or contact support.",
        });
      }
    }
  };

  const handleCheckStatus = async () => {
    try {
      const project = await checkStatus();
      if (project) {
        onComplete(project);
        toast({
          title: "Project Found! 🎉",
          description: `Your project "${project.name}" was successfully created.`,
        });
      }
    } catch (error) {
      console.error("Status check error:", error);
      toast({
        variant: "destructive",
        title: "Check Failed",
        description: "Unable to check project status. Please try again.",
      });
    }
  };

  const canProceed = () => {
    const currentStepId = steps[currentStep]?.id;

    switch (currentStepId) {
      case "template":
        return projectData.template !== "";
      case "product-upload":
        return (
          projectData.productImages.length > 0 &&
          !projectData.isUploadingProduct
        );
      case "details":
        return (
          projectData.name.trim() !== "" &&
          projectData.productName.trim() !== "" &&
          projectData.description.trim() !== ""
        );
      case "format":
        return projectData.format !== "" && projectData.style !== "";
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    const currentStepId = steps[currentStep]?.id;

    switch (currentStepId) {
      case "template":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center">
              <motion.h2
                className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 md:text-5xl"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                What&apos;s your vision?
              </motion.h2>
              <motion.p
                className="mx-auto max-w-2xl text-xl text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Choose how you want to showcase your brand
              </motion.p>
            </div>

            <div className="grid gap-6 mx-auto max-w-4xl">
              {PROJECT_TEMPLATES.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={cn(
                      "cursor-pointer transition-all duration-300 border-2 group relative overflow-hidden",
                      projectData.template === template.id
                        ? "border-primary shadow-2xl shadow-primary/20"
                        : "border-muted hover:border-primary/50 hover:shadow-xl"
                    )}
                    onClick={() => {
                      setProjectData({
                        ...projectData,
                        template: template.id,
                        adType: template.adType,
                      });
                    }}
                  >
                    {/* Gradient background on hover */}
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300",
                        template.gradient
                      )}
                    />

                    <CardContent className="p-8">
                      <div className="flex gap-6 items-center">
                        {/* Animated Icon */}
                        <motion.div
                          className={cn(
                            "w-24 h-24 rounded-2xl bg-gradient-to-br flex items-center justify-center text-4xl shadow-lg",
                            template.gradient
                          )}
                          whileHover={{ rotate: [0, -5, 5, 0] }}
                          transition={{ duration: 0.5 }}
                        >
                          {template.thumbnail}
                        </motion.div>

                        {/* Content */}
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-bold">
                              {template.name}
                            </h3>
                            {/* Selection Indicator */}
                            <motion.div
                              initial={false}
                              animate={{
                                scale:
                                  projectData.template === template.id ? 1 : 0,
                                opacity:
                                  projectData.template === template.id ? 1 : 0,
                              }}
                              className="flex justify-center items-center w-8 h-8 rounded-full bg-primary"
                            >
                              <Check className="w-5 h-5 text-primary-foreground" />
                            </motion.div>
                          </div>

                          <p className="text-lg text-muted-foreground">
                            {template.description}
                          </p>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-2">
                            {template.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="px-3 py-1"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {/* Example */}
                          <p className="text-sm italic text-muted-foreground/80">
                            Perfect for: {template.example}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case "product-upload":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center">
              <motion.h2
                className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 md:text-5xl"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Show us your product
              </motion.h2>
              <motion.p
                className="mx-auto max-w-2xl text-xl text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Upload a high-quality image for AI to create stunning visuals
              </motion.p>
            </div>

            <div className="mx-auto space-y-6 max-w-2xl">
              {/* Single Upload */}
              <div className="flex justify-center">
                {(() => {
                  const index = 0;
                  const image = projectData.productImages[index];
                  const isUploading =
                    projectData.isUploadingProduct &&
                    projectData.uploadingImageIndex === index;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="w-80 aspect-square"
                    >
                      {image ? (
                        // Existing image
                        <div className="overflow-hidden relative w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl group">
                          <Image
                            src={image.displayUrl}
                            alt={`Product ${index + 1}`}
                            fill
                            className="object-cover"
                          />

                          {/* Overlay on hover */}
                          <div className="flex absolute inset-0 gap-4 justify-center items-center opacity-0 transition-opacity duration-300 bg-black/60 group-hover:opacity-100">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="rounded-full"
                              onClick={() =>
                                document
                                  .getElementById(`product-upload-${index}`)
                                  ?.click()
                              }
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="rounded-full"
                              onClick={() => handleRemoveProductImage(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          <input
                            id={`product-upload-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleProductImageUpload(file, index);
                              }
                            }}
                          />

                          {/* Badge */}
                          <Badge className="absolute top-4 left-4 backdrop-blur-sm bg-black/80">
                            Product Image
                          </Badge>
                        </div>
                      ) : (
                        // Empty slot
                        <motion.div
                          className={cn(
                            "flex flex-col justify-center items-center w-full h-full rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group",
                            isUploading
                              ? "border-primary bg-primary/5"
                              : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
                          )}
                          onClick={() =>
                            !isUploading &&
                            document
                              .getElementById(`product-upload-${index}`)
                              ?.click()
                          }
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <input
                            id={`product-upload-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleProductImageUpload(file);
                              }
                            }}
                          />

                          {isUploading ? (
                            <div className="space-y-3 text-center">
                              <Loader2 className="mx-auto w-12 h-12 animate-spin text-primary" />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  Uploading...
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  AI is analyzing your product
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-6 space-y-3 text-center">
                              <div className="flex justify-center items-center mx-auto w-16 h-16 rounded-full transition-colors bg-muted group-hover:bg-primary/10">
                                <Upload className="w-8 h-8 transition-colors text-muted-foreground group-hover:text-primary" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium">
                                  Upload product image
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Required
                                </p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })()}
              </div>

              {/* Tips Card */}
              {projectData.productImages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="border-dashed">
                    <CardContent className="p-6">
                      <h3 className="flex gap-2 items-center mb-3 font-semibold">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Pro Tips for Best Results
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div className="space-y-2">
                          <p>📸 Use high-resolution images</p>
                          <p>💡 Good lighting is essential</p>
                        </div>
                        <div className="space-y-2">
                          <p>🎯 Show product clearly</p>
                          <p>🎨 Clean backgrounds work best</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* AI Analysis */}
              {projectData.productImages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-primary/20">
                    <CardContent className="p-6">
                      <h4 className="flex gap-2 items-center mb-4 font-semibold">
                        <Wand2 className="w-5 h-5 text-primary" />
                        AI Product Analysis
                      </h4>
                      <div className="space-y-3">
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                          className="p-3 rounded-lg backdrop-blur-sm bg-background/50"
                        >
                          <p className="mb-1 text-sm font-medium">
                            Product insights:
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {projectData.productImages[0].visionAnalysis}
                          </p>
                        </motion.div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </motion.div>
        );

      case "details":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto space-y-8 max-w-3xl"
          >
            <div className="text-center">
              <motion.h2
                className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 md:text-5xl"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Tell us more
              </motion.h2>
              <motion.p
                className="text-xl text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Give your project a name and identity
              </motion.p>
            </div>

            <motion.div
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="space-y-3">
                <Label htmlFor="project-name" className="text-lg font-medium">
                  Project Name
                </Label>
                <Input
                  id="project-name"
                  placeholder="e.g., Summer Collection Launch"
                  value={projectData.name}
                  onChange={(e) =>
                    setProjectData({ ...projectData, name: e.target.value })
                  }
                  className="h-14 text-lg rounded-xl"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="product-name" className="text-lg font-medium">
                  Product/Brand Name
                  <span className="ml-1 text-primary">*</span>
                </Label>
                <Input
                  id="product-name"
                  placeholder="e.g., Nike Air Max, iPhone 15 Pro"
                  value={projectData.productName}
                  onChange={(e) =>
                    setProjectData({
                      ...projectData,
                      productName: e.target.value,
                    })
                  }
                  className="h-14 text-lg rounded-xl"
                />
                <p className="text-sm text-muted-foreground">
                  The specific product or brand featured in your ad
                </p>
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="project-description"
                  className="text-lg font-medium"
                >
                  Campaign Brief
                  <span className="ml-1 text-primary">*</span>
                </Label>
                <Textarea
                  id="project-description"
                  placeholder={
                    projectData.template === "product-video"
                      ? "Describe your product's key features, benefits, and what makes it special..."
                      : "Describe your campaign vision. Include target audience (e.g., young professionals 25-35), key messages, brand values, unique selling points, and any specific requirements..."
                  }
                  value={projectData.description}
                  onChange={(e) =>
                    setProjectData({
                      ...projectData,
                      description: e.target.value,
                    })
                  }
                  rows={6}
                  className="text-base rounded-xl resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  {projectData.template === "product-video"
                    ? "Focus on what makes your product unique and appealing to customers."
                    : "The more details you provide, the better AI can tailor your video to your needs."}
                </p>
              </div>

              {/* Character count */}
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {projectData.description.length}/1000 characters
                </p>
              </div>
            </motion.div>
          </motion.div>
        );

      case "format":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            <div className="text-center">
              <motion.h2
                className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 md:text-5xl"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Design your experience
              </motion.h2>
              <motion.p
                className="text-xl text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Choose format, style, and animation settings
              </motion.p>
            </div>

            {/* Format Selection */}
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-2xl font-semibold">Video Format</h3>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {FORMATS.map((format, index) => {
                  const Icon = format.icon;
                  return (
                    <motion.div
                      key={format.value}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 + 0.3 }}
                      whileHover={{ scale: format.value === "9:16" ? 1.05 : 1 }}
                      whileTap={{ scale: format.value === "9:16" ? 0.95 : 1 }}
                    >
                      <Card
                        className={cn(
                          "transition-all relative group",
                          format.value === "9:16"
                            ? projectData.format === format.value
                              ? "ring-2 ring-primary shadow-lg bg-primary/5 cursor-pointer"
                              : "hover:shadow-md hover:ring-1 hover:ring-primary/50 cursor-pointer"
                            : "opacity-60 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (format.value === "9:16") {
                            setProjectData({
                              ...projectData,
                              format: format.value,
                            });
                          }
                        }}
                      >
                        {format.value === "9:16" && format.popular && (
                          <Badge className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-purple-500 to-blue-500">
                            Popular
                          </Badge>
                        )}
                        {format.value !== "9:16" && (
                          <Badge className="absolute -top-2 -right-2 z-10 bg-gray-500">
                            Coming Soon
                          </Badge>
                        )}
                        <CardContent className="p-6 text-center">
                          <div
                            className={cn(
                              "flex justify-center items-center mx-auto mb-3 w-12 h-12 rounded-xl transition-transform",
                              format.value === "9:16"
                                ? "bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110"
                                : "bg-gray-200 dark:bg-gray-700"
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-6 h-6",
                                format.value === "9:16"
                                  ? "text-primary"
                                  : "text-gray-400"
                              )}
                            />
                          </div>
                          <h4
                            className={cn(
                              "text-lg font-semibold",
                              format.value !== "9:16" && "text-gray-500"
                            )}
                          >
                            {format.name}
                          </h4>
                          <p
                            className={cn(
                              "mt-1 text-sm",
                              format.value === "9:16"
                                ? "text-muted-foreground"
                                : "text-gray-400"
                            )}
                          >
                            {format.description}
                          </p>
                          <p
                            className={cn(
                              "mt-2 font-mono text-xs",
                              format.value === "9:16"
                                ? "text-muted-foreground"
                                : "text-gray-400"
                            )}
                          >
                            {format.dimensions}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Style Selection */}
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-2xl font-semibold">Visual Style</h3>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {STYLES.map((style, index) => (
                  <motion.div
                    key={style.value}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + 0.4 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Card
                      className={cn(
                        "cursor-pointer transition-all group",
                        projectData.style === style.value
                          ? "ring-2 ring-primary shadow-lg bg-primary/5"
                          : "hover:shadow-md hover:ring-1 hover:ring-primary/50"
                      )}
                      onClick={() =>
                        setProjectData({ ...projectData, style: style.value })
                      }
                    >
                      <CardContent className="p-6 text-center">
                        <div className="mb-3 text-4xl transition-transform group-hover:scale-110">
                          {style.preview}
                        </div>
                        <h4 className="text-lg font-semibold">{style.name}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {style.description}
                        </p>
                        <p className="mt-2 text-xs font-medium text-primary">
                          {style.mood}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Duration and Scenes */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
            >
              <Card className="p-6">
                <Label className="flex gap-2 items-center mb-4 text-lg font-medium">
                  <Clock className="w-5 h-5 text-primary" />
                  Video Duration
                </Label>
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-4xl font-bold text-primary">
                      {projectData.totalDuration}
                    </span>
                    <span className="ml-1 text-2xl text-muted-foreground">
                      seconds
                    </span>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Max {projectData.numScenes * 5}s ({projectData.numScenes}{" "}
                    scenes × 5s)
                  </p>
                  <Slider
                    value={[projectData.totalDuration]}
                    onValueChange={([value]) =>
                      setProjectData({ ...projectData, totalDuration: value })
                    }
                    max={projectData.numScenes * 5} // 5 seconds max per scene
                    min={projectData.numScenes} // 1 second min per scene
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{projectData.numScenes}s</span>
                    <span>
                      {Math.round(
                        (projectData.numScenes * 5 + projectData.numScenes) / 2
                      )}
                      s
                    </span>
                    <span>{projectData.numScenes * 5}s</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="flex gap-2 items-center mb-4 text-lg font-medium">
                  <Film className="w-5 h-5 text-primary" />
                  Number of Scenes
                </Label>
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-4xl font-bold text-primary">
                      {projectData.numScenes}
                    </span>
                    <span className="ml-1 text-2xl text-muted-foreground">
                      scenes
                    </span>
                  </div>
                  <Slider
                    value={[projectData.numScenes]}
                    onValueChange={([value]) => {
                      // Adjust total duration if it exceeds the new maximum
                      const maxDuration = value * 5;
                      const adjustedDuration = Math.min(
                        projectData.totalDuration,
                        maxDuration
                      );
                      setProjectData({
                        ...projectData,
                        numScenes: value,
                        totalDuration: adjustedDuration,
                      });
                    }}
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Simple</span>
                    <span>Standard</span>
                    <span>Complex</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Animation Settings */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="p-8 bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-primary/20">
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="flex gap-2 items-center text-2xl font-semibold">
                        <Play className="w-6 h-6 text-primary" />
                        Animation Magic
                        <Badge className="ml-2 text-green-600 bg-green-500/10">
                          Recommended
                        </Badge>
                      </h3>
                      <p className="mt-1 text-muted-foreground">
                        Bring your scenes to life with AI video generation
                      </p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="flex justify-between items-center p-6 rounded-xl backdrop-blur-sm bg-background/80">
                    <div className="space-y-1">
                      <Label className="text-lg font-medium">
                        Auto-animate all scenes
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Generate stunning AI videos for every scene
                        automatically
                      </p>
                    </div>
                    <Switch
                      checked={projectData.animateAllScenes}
                      onCheckedChange={(checked) =>
                        setProjectData({
                          ...projectData,
                          animateAllScenes: checked,
                        })
                      }
                      className="scale-125"
                    />
                  </div>

                  {/* Provider Selection */}
                  <AnimatePresence>
                    {projectData.animateAllScenes && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        <Label className="text-lg font-medium">
                          Choose your AI engine
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                          <Card
                            className={cn(
                              "cursor-pointer transition-all hover:shadow-md group",
                              projectData.animationProvider === "bytedance"
                                ? "ring-2 ring-yellow-500 bg-yellow-500/5"
                                : "hover:ring-1 hover:ring-yellow-500/50"
                            )}
                            onClick={() =>
                              setProjectData({
                                ...projectData,
                                animationProvider: "bytedance",
                              })
                            }
                          >
                            <CardContent className="p-6">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <div className="p-3 bg-gradient-to-br rounded-xl transition-transform from-yellow-500/20 to-orange-500/20 group-hover:scale-110">
                                    <Zap className="w-6 h-6 text-yellow-600" />
                                  </div>
                                  {projectData.animationProvider ===
                                    "bytedance" && (
                                    <CheckCircle className="w-6 h-6 text-yellow-500" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-lg font-semibold">
                                    Bytedance
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    Lightning fast • High quality
                                  </p>
                                  <Badge className="mt-2 text-yellow-700 bg-yellow-500/10">
                                    Recommended
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card
                            className={cn(
                              "cursor-pointer transition-all hover:shadow-md group",
                              projectData.animationProvider === "runway"
                                ? "ring-2 ring-blue-500 bg-blue-500/5"
                                : "hover:ring-1 hover:ring-blue-500/50"
                            )}
                            onClick={() =>
                              setProjectData({
                                ...projectData,
                                animationProvider: "runway",
                              })
                            }
                          >
                            <CardContent className="p-6">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <div className="p-3 bg-gradient-to-br rounded-xl transition-transform from-blue-500/20 to-purple-500/20 group-hover:scale-110">
                                    <Clapperboard className="w-6 h-6 text-blue-600" />
                                  </div>
                                  {projectData.animationProvider ===
                                    "runway" && (
                                    <CheckCircle className="w-6 h-6 text-blue-500" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-lg font-semibold">
                                    Runway Gen-4
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    Cinematic quality • Premium
                                  </p>
                                  <Badge className="mt-2 text-blue-700 bg-blue-500/10">
                                    Pro Choice
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Info box */}
                        <div className="p-4 rounded-xl border bg-primary/5 border-primary/20">
                          <div className="flex gap-3 items-start">
                            <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                What happens next?
                              </p>
                              <p className="text-sm text-muted-foreground">
                                AI will generate {projectData.numScenes}{" "}
                                animated videos using{" "}
                                {projectData.animationProvider === "bytedance"
                                  ? "Bytedance's cutting-edge"
                                  : "Runway's cinematic"}{" "}
                                technology, bringing your vision to life
                                automatically.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        );

      case "preview":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto space-y-8 max-w-4xl"
          >
            <div className="text-center">
              <motion.h2
                className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 md:text-5xl"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Ready to create magic?
              </motion.h2>
              <motion.p
                className="text-xl text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Review your settings and let&apos;s make something amazing
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid gap-6"
            >
              {/* Main Info Card */}
              <Card className="overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-purple-600 to-blue-600">
                  <h3 className="text-2xl font-bold text-white">
                    {projectData.name || "Untitled Project"}
                  </h3>
                  <p className="mt-1 text-white/80">
                    {
                      PROJECT_TEMPLATES.find(
                        (t) => t.id === projectData.template
                      )?.name
                    }
                  </p>
                </div>
                <CardContent className="p-6 space-y-6">
                  {/* Product Images for product video */}
                  {projectData.template === "product-video" &&
                    projectData.productImages.length > 0 && (
                      <div>
                        <h4 className="mb-3 font-semibold">Product Image</h4>
                        <div className="flex justify-center">
                          <div className="overflow-hidden relative w-32 h-32 rounded-lg bg-muted">
                            <Image
                              src={projectData.productImages[0].displayUrl}
                              alt="Product"
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Project Details Grid */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Format</p>
                      <p className="font-semibold">{projectData.format}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Style</p>
                      <p className="font-semibold capitalize">
                        {projectData.style}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">
                        {projectData.totalDuration} seconds
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Scenes</p>
                      <p className="font-semibold">
                        {projectData.numScenes} scenes
                      </p>
                    </div>
                  </div>

                  {/* Animation Settings */}
                  {projectData.animateAllScenes && (
                    <div className="p-4 bg-gradient-to-r rounded-lg from-purple-500/10 to-blue-500/10">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-3 items-center">
                          <div className="p-2 rounded-lg bg-primary/20">
                            <Play className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              Auto-animation enabled
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Using{" "}
                              {projectData.animationProvider === "bytedance"
                                ? "Bytedance Seedance"
                                : "Runway Gen-4"}
                            </p>
                          </div>
                        </div>
                        <CheckCircle className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  )}

                  {/* Campaign Brief */}
                  {projectData.description && (
                    <div>
                      <h4 className="mb-2 font-semibold">Campaign Brief</h4>
                      <p className="p-4 text-sm rounded-lg text-muted-foreground bg-muted">
                        {projectData.description}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Generate Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full h-16 text-lg text-white bg-gradient-to-r from-purple-600 to-blue-600 shadow-xl dark:text-white hover:from-purple-700 hover:to-blue-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 w-6 h-6 animate-spin dark:text-white" />
                      Creating your masterpiece...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 w-6 h-6 dark:text-white" />
                      Generate AI Video Ad
                    </>
                  )}
                </Button>

                {/* Timeout handling UI */}
                {timedOut && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Project generation is taking longer than expected. The
                        project may still be creating in the background.
                      </p>
                    </div>
                    <Button
                      onClick={handleCheckStatus}
                      variant="outline"
                      size="lg"
                      className="w-full"
                    >
                      <Eye className="mr-2 w-4 h-4" />
                      Check Project Status
                    </Button>
                  </motion.div>
                )}

                {/* Progress display */}
                {progress && !timedOut && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <p className="text-sm text-muted-foreground">{progress}</p>
                    {isGenerating && (
                      <div className="flex gap-2 justify-center mt-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-primary"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{
                              repeat: Infinity,
                              duration: 1.5,
                              delay: i * 0.2,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container px-4 py-8 mx-auto">
        {/* Header with Progress */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="text-3xl font-bold">Create New Project</h1>
              <p className="mt-1 text-muted-foreground">
                Step {currentStep + 1} of {steps.length}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button
                variant="ghost"
                onClick={onCancel}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="mr-2 w-4 h-4" />
                Cancel
              </Button>
            </motion.div>
          </div>

          {/* Modern Progress Bar */}
          <div className="relative">
            {/* Background line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />

            {/* Progress line */}
            <motion.div
              className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-purple-600 to-blue-600"
              initial={{ width: 0 }}
              animate={{
                width: `${((currentStep + 1) / steps.length) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />

            {/* Step indicators */}
            <div className="flex relative justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <motion.div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative",
                        isCompleted || isCurrent
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg cursor-pointer"
                          : "bg-muted text-muted-foreground",
                        isCompleted && "cursor-pointer hover:scale-110"
                      )}
                      whileHover={{ scale: isCompleted || isCurrent ? 1.1 : 1 }}
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                      transition={
                        isCurrent ? { repeat: Infinity, duration: 2 } : {}
                      }
                      onClick={() => {
                        // Allow jumping to completed steps or current step
                        if (isCompleted || isCurrent) {
                          setCurrentStep(index);
                        }
                      }}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </motion.div>
                    <span
                      className={cn(
                        "mt-2 text-xs font-medium transition-colors",
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-12">
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>

        {/* Navigation */}
        {currentStep < steps.length - 1 && (
          <motion.div
            className="flex justify-between mx-auto max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
              size="lg"
              className="gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              size="lg"
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
