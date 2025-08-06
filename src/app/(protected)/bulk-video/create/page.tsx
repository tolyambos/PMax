"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  FileText,
  Palette,
  Settings,
  Database,
  Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";

// Import wizard steps
import { ProjectBasicsStep } from "@/app/components/bulk-video/wizard-steps/project-basics";
import { BrandConfigStep } from "@/app/components/bulk-video/wizard-steps/brand-config";
import { DefaultSettingsStep } from "@/app/components/bulk-video/wizard-steps/default-settings";
import { DataImportStep } from "@/app/components/bulk-video/wizard-steps/data-import";
import { ReviewStep } from "@/app/components/bulk-video/wizard-steps/review";

import { 
  BulkVideoProjectSettings, 
  BulkVideoData,
  DataSourceType 
} from "@/app/types/bulk-video";

const WIZARD_STEPS = [
  { id: 1, name: "Project Basics", icon: FileText },
  { id: 2, name: "Brand Configuration", icon: Palette },
  { id: 3, name: "Default Settings", icon: Settings },
  { id: 4, name: "Data Import", icon: Database },
  { id: 5, name: "Review & Generate", icon: Rocket },
];

export default function BulkVideoCreatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Wizard state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  
  const [brandSettings, setBrandSettings] = useState<Partial<BulkVideoProjectSettings>>({
    logoPosition: "bottom-right",
    logoSize: { width: 120, height: 60 },
    defaultFormats: ["1080x1920", "1920x1080", "1080x1080"],
    defaultVideoStyle: "modern product showcase",
    defaultImageStyle: "professional product photography",
    defaultAnimationProvider: "bytedance",
    defaultDuration: 5,
    defaultSceneCount: 3,
    defaultCameraFixed: false,
    defaultUseEndImage: false,
    defaultAnimationPromptMode: "ai",
    defaultAnimationTemplate: undefined,
  });

  const [dataSource, setDataSource] = useState<{
    type: DataSourceType;
    file?: File;
    sheetsUrl?: string;
    videos: BulkVideoData[];
  }>({
    type: "csv",
    videos: [],
  });

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("projectName", projectName);
      formData.append("projectDescription", projectDescription || "");
      formData.append("settings", JSON.stringify(brandSettings));
      formData.append("dataSourceType", dataSource.type);
      
      if (dataSource.file) {
        formData.append("dataFile", dataSource.file);
      } else if (dataSource.sheetsUrl) {
        formData.append("sheetsUrl", dataSource.sheetsUrl);
      } else if (dataSource.videos.length > 0) {
        formData.append("videos", JSON.stringify(dataSource.videos));
      }

      const response = await fetch("/api/bulk-video/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create bulk video project");
      }

      const { projectId } = await response.json();

      toast({
        title: "Success!",
        description: "Bulk video project created. Starting generation...",
      });

      // Navigate to the bulk video management page
      router.push(`/bulk-video/${projectId}`);
    } catch (error) {
      console.error("Failed to create bulk video project:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create project",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return projectName.trim().length > 0;
      case 2:
        return brandSettings.brandLogoUrl && brandSettings.logoPosition;
      case 3:
        return true; // Default settings are optional
      case 4:
        return dataSource.videos.length > 0 || dataSource.file || dataSource.sheetsUrl;
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Create Bulk Video Project
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate multiple videos from your data with consistent branding
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {WIZARD_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center",
                  index < WIZARD_STEPS.length - 1 && "flex-1"
                )}
              >
                <button
                  onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                  disabled={currentStep < step.id}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg transition-all",
                    currentStep === step.id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : currentStep > step.id
                      ? "text-green-600 dark:text-green-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all",
                      currentStep === step.id
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : currentStep > step.id
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-gray-100 dark:bg-gray-700"
                    )}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-xs font-medium">{step.name}</span>
                </button>
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-1 mx-2 rounded-full transition-all",
                      currentStep > step.id ? "bg-green-200 dark:bg-green-700" : "bg-gray-200 dark:bg-gray-700"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStep === 1 && (
                <ProjectBasicsStep
                  projectName={projectName}
                  projectDescription={projectDescription}
                  onNameChange={setProjectName}
                  onDescriptionChange={setProjectDescription}
                />
              )}
              {currentStep === 2 && (
                <BrandConfigStep
                  settings={brandSettings}
                  onSettingsChange={setBrandSettings}
                />
              )}
              {currentStep === 3 && (
                <DefaultSettingsStep
                  settings={brandSettings}
                  onSettingsChange={setBrandSettings}
                />
              )}
              {currentStep === 4 && (
                <DataImportStep
                  dataSource={dataSource}
                  onDataSourceChange={setDataSource}
                />
              )}
              {currentStep === 5 && (
                <ReviewStep
                  projectName={projectName}
                  projectDescription={projectDescription}
                  brandSettings={brandSettings as BulkVideoProjectSettings}
                  dataSource={dataSource}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="max-w-4xl mx-auto mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep < WIZARD_STEPS.length ? (
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex items-center gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!isStepValid() || isGenerating}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Videos
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}