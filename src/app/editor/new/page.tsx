"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainNavigation from "@/app/components/navigation/main-nav";
import { Button } from "@/app/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/app/components/ui/use-toast";

const videoFormats = [
  {
    id: "9:16",
    name: "9:16 (Instagram/TikTok Story)",
    width: 1080,
    height: 1920,
  },
  {
    id: "1:1",
    name: "1:1 (Square - Instagram, Facebook)",
    width: 1080,
    height: 1080,
  },
  { id: "16:9", name: "16:9 (Landscape - YouTube)", width: 1920, height: 1080 },
  { id: "4:5", name: "4:5 (Instagram Post)", width: 1080, height: 1350 },
];

// Ad types with descriptions
const adTypes = [
  {
    id: "product",
    name: "Product Advertisement",
    description: "Showcase features and benefits of a specific product",
    icon: "📱",
  },
  {
    id: "brand",
    name: "Brand Awareness",
    description: "Increase recognition and visibility of your brand",
    icon: "🏆",
  },
  {
    id: "promo",
    name: "Special Promotion",
    description: "Highlight a limited-time offer, discount or event",
    icon: "🎁",
  },
  {
    id: "tutorial",
    name: "How-to/Tutorial",
    description: "Demonstrate usage of a product or service",
    icon: "📝",
  },
  {
    id: "testimonial",
    name: "Testimonial/Review",
    description: "Feature customer reviews and success stories",
    icon: "👥",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State for multi-step form
  const [step, setStep] = useState(1);

  // Project details
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Ad specifications
  const [adType, setAdType] = useState("");
  const [productName, setProductName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [keyPoints, setKeyPoints] = useState("");

  // Visual style and format
  const [format, setFormat] = useState("9:16");
  const [style, setStyle] = useState("realistic");
  const [numScenes, setNumScenes] = useState(3);
  const [totalDuration, setTotalDuration] = useState(15); // Default 15 seconds total duration

  // Function to keep totalDuration in valid range when numScenes changes
  useEffect(() => {
    // Calculate valid min/max duration range
    const minDuration = numScenes * 1;
    const maxDuration = numScenes * 10;

    // If current duration is outside range, adjust it
    if (totalDuration < minDuration) {
      setTotalDuration(minDuration);
    } else if (totalDuration > maxDuration) {
      setTotalDuration(maxDuration);
    }
  }, [numScenes, totalDuration]);

  // Processing state
  const [isCreating, setIsCreating] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);

  const handleNextStep = () => {
    // Validate current step
    if (step === 1 && !name) {
      toast({
        title: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    if (step === 2 && !adType) {
      toast({
        title: "Please select an ad type",
        variant: "destructive",
      });
      return;
    }

    if (step === 2 && !productName) {
      toast({
        title: "Please enter your product or brand name",
        variant: "destructive",
      });
      return;
    }

    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setStep(Math.max(1, step - 1));
  };

  const handleCreate = async () => {
    setIsCreating(true);

    try {
      // 1. First, update progress for creating project
      setProgressMessage("Creating project...");
      setGenerationProgress(10);

      // 2. Prepare project data
      const projectData = {
        name,
        description,
        adType,
        productName,
        targetAudience,
        keyPoints,
        format,
        style,
        numScenes,
        totalDuration,
      };

      // 3. Generate ad concept
      setProgressMessage("Generating ad concept based on your inputs...");
      setGenerationProgress(25);

      // 4. Call the API to create the project with scenes
      try {
        const response = await fetch("/api/ai/generate-project", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(projectData),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // Simulate more detailed progress to match the actual API work happening
        setProgressMessage("Creating storyboard for your scenes...");
        setGenerationProgress(40);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Simulate progress for each scene
        for (let i = 0; i < numScenes; i++) {
          const sceneNum = i + 1;
          setProgressMessage(`Generating scene ${sceneNum} of ${numScenes}...`);
          setGenerationProgress(40 + i * (50 / numScenes));
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        // Parse response data
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to generate project");
        }

        // 5. Finalizing project
        setProgressMessage("Finalizing your project...");
        setGenerationProgress(95);
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Complete
        setProgressMessage("Project created successfully!");
        setGenerationProgress(100);

        // Store the generated scenes in localStorage AND sessionStorage for persistence
        console.log(`Storing ${data.scenes.length} scenes for editor`);

        // Clear all storage keys first
        localStorage.removeItem("generatedScenes");
        localStorage.removeItem("projectData");
        localStorage.removeItem("pmax_editor_data");
        sessionStorage.removeItem("pmax_editor_data");

        // Create data structure with timestamp
        const timestamp = Date.now();
        const editorData = {
          timestamp,
          scenes: data.scenes,
          projectInfo: {
            name: data.name,
            description: data.description,
            format: data.format,
            projectId: data.projectId,
          },
        };

        // IMPORTANT: Use 'pmax_editor_data_' + projectId as the key to ensure it's unique per project
        const storageKey = `pmax_editor_data_${data.projectId}`;

        // Store in both localStorage and sessionStorage for redundancy
        try {
          // Store in localStorage (persists across tabs/sessions)
          localStorage.setItem(storageKey, JSON.stringify(editorData));

          // Also store in sessionStorage (persists only in current tab)
          sessionStorage.setItem(storageKey, JSON.stringify(editorData));

          // Store the key name itself separately so we can find it later
          localStorage.setItem("pmax_active_project", data.projectId);
          sessionStorage.setItem("pmax_active_project", data.projectId);

          console.log(`Data stored successfully with key: ${storageKey}`);
        } catch (error) {
          console.error("Error storing project data:", error);
        }

        // Wait a moment then redirect to the editor with the projectId from the API
        // Give enough time for localStorage to be updated
        setTimeout(() => {
          console.log(
            "Redirecting to editor with new data, project ID:",
            data.projectId
          );
          // Add debug logging to show exactly what's being passed
          console.log("Project created response data:", JSON.stringify(data));
          // Make sure we have a valid project ID before redirecting
          if (data.projectId) {
            // Use the Next.js router instead of window.location for a more reliable navigation
            console.log("Router redirecting to:", `/editor/${data.projectId}`);

            // Verify that the project exists in the database before redirecting
            fetch(
              `/api/db-check/project?id=${encodeURIComponent(data.projectId)}`
            )
              .then((response) => response.json())
              .then((projectData) => {
                console.log("Project check before redirect:", projectData);

                if (projectData.exists) {
                  // Project exists, safe to redirect
                  console.log("Confirmed project exists in DB, redirecting...");
                  router.push(`/editor/${data.projectId}`);
                } else {
                  // Wait a bit more for database consistency
                  console.log(
                    "Project not yet found in DB, waiting 2s more..."
                  );
                  setTimeout(() => {
                    router.push(`/editor/${data.projectId}`);
                  }, 2000);
                }
              })
              .catch((err) => {
                console.error("Error checking project before redirect:", err);
                // Redirect anyway as a fallback
                router.push(`/editor/${data.projectId}`);
              });
          } else {
            console.error("No project ID returned from API");
            toast({
              title: "Error",
              description:
                "No project ID returned from API. Check console for details.",
              variant: "destructive",
            });
          }
        }, 2000);
      } catch (apiError) {
        console.error("API Error:", apiError);

        // If the API fails, fallback to demo mode
        console.log("Falling back to demo mode due to API error");

        // Complete with demo mode
        setProgressMessage("Demo mode: Project created successfully!");
        setGenerationProgress(100);

        // Generate a project ID and redirect to editor
        const demoProjectId = "demo-project-" + Date.now();

        // Wait a moment then redirect
        setTimeout(() => {
          router.push(`/editor/${demoProjectId}`);
        }, 1500);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Error creating project",
        description: "Please try again later",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  // Render the current step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-semibold">Project Details</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Let&apos;s start with some basic information about your project.
              </p>
            </div>

            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium">
                Project Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="My Awesome Video"
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block mb-2 text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Brief description of your project"
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-semibold">Ad Specifications</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Tell us about the ad you want to create.
              </p>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">
                Ad Type *
              </label>
              <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-2">
                {adTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      adType === type.id
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted/50"
                    }`}
                    onClick={() => setAdType(type.id)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2 text-2xl">{type.icon}</span>
                      <div>
                        <h3 className="text-sm font-medium">{type.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="productName"
                className="block mb-2 text-sm font-medium"
              >
                Product or Brand Name *
              </label>
              <input
                id="productName"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Acme Smartwatch"
                required
              />
            </div>

            <div>
              <label
                htmlFor="targetAudience"
                className="block mb-2 text-sm font-medium"
              >
                Target Audience
              </label>
              <input
                id="targetAudience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Young professionals, 25-40 years old"
              />
            </div>

            <div>
              <label
                htmlFor="keyPoints"
                className="block mb-2 text-sm font-medium"
              >
                Key Points to Highlight
              </label>
              <textarea
                id="keyPoints"
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="What are the main selling points or messages? e.g. Water resistant, 2-day battery life, premium design"
                rows={4}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-semibold">Visual Style</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Configure how your ad will look and how many scenes it will
                have.
              </p>
            </div>

            <div>
              <label
                htmlFor="format"
                className="block mb-2 text-sm font-medium"
              >
                Video Format *
              </label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {videoFormats.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-3 justify-center mt-2">
                {videoFormats.map((fmt) => (
                  <div
                    key={fmt.id}
                    className={`cursor-pointer p-1 rounded ${format === fmt.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setFormat(fmt.id)}
                  >
                    <div
                      className="bg-muted"
                      style={{
                        width:
                          fmt.id === "9:16"
                            ? "36px"
                            : fmt.id === "16:9"
                              ? "64px"
                              : fmt.id === "1:1"
                                ? "48px"
                                : "40px",
                        height:
                          fmt.id === "9:16"
                            ? "64px"
                            : fmt.id === "16:9"
                              ? "36px"
                              : fmt.id === "1:1"
                                ? "48px"
                                : "50px",
                      }}
                    />
                    <div className="mt-1 text-xs text-center">{fmt.id}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="style" className="block mb-2 text-sm font-medium">
                Visual Style *
              </label>
              <select
                id="style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="px-3 py-2 w-full text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="realistic">Realistic</option>
                <option value="cinematic">Cinematic</option>
                <option value="3D rendered">3D Rendered</option>
                <option value="minimalist">Minimalist</option>
                <option value="cartoon">Cartoon</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="numScenes"
                className="block mb-2 text-sm font-medium"
              >
                Number of Scenes *
              </label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={numScenes}
                  onChange={(e) => setNumScenes(parseInt(e.target.value))}
                  className="flex-1 mr-4"
                />
                <div className="w-8 text-center">{numScenes}</div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Select how many scenes your ad will have (1-5)
              </p>
            </div>

            <div>
              <label
                htmlFor="totalDuration"
                className="block mb-2 text-sm font-medium"
              >
                Total Video Duration *
              </label>
              <div className="flex items-center">
                <input
                  type="range"
                  min={numScenes * 1} // Minimum 1 second per scene
                  max={numScenes * 5} // Maximum 5 seconds per scene
                  value={totalDuration}
                  onChange={(e) => setTotalDuration(parseInt(e.target.value))}
                  className="flex-1 mr-4"
                />
                <div className="w-16 text-center">{totalDuration}s</div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Set the total duration of your video ({numScenes * 1}-
                {numScenes * 5} seconds)
              </p>
            </div>

            <div>
              <div className="p-3 bg-amber-50 rounded-md border border-amber-200">
                <h4 className="mb-1 text-sm font-medium text-amber-800">
                  Ready to create your ad?
                </h4>
                <p className="text-xs text-amber-700">
                  When you click &quot;Create&quot;, we&apos;ll generate a
                  complete ad concept with {numScenes} scenes based on your
                  specifications. This may take a few moments.
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-4 text-lg font-semibold">Creating Your Ad</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {progressMessage}
              </p>
            </div>

            <div className="w-full bg-muted rounded-full h-2.5 mb-6">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>

            <div className="flex justify-center mt-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>

            {generationProgress === 100 && (
              <div className="mt-8 text-center">
                <h3 className="mb-2 text-lg font-medium text-green-600">
                  Success!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your project has been created. Redirecting to the editor...
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="container flex flex-col flex-1 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">New Project</h1>
          <p className="text-muted-foreground">Create an AI-powered video advertisement</p>
        </div>
        {/* Step indicator */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              {["Project Details", "Ad Specifications", "Visual Style"].map(
                (stepName, index) => (
                  <div
                    key={index}
                    className={`text-xs font-medium ${step === index + 1 ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {stepName}
                  </div>
                )
              )}
            </div>
            <div className="flex mb-2">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex-1">
                  <div
                    className={`h-1 ${stepNum <= step ? "bg-primary" : "bg-muted"} 
                      ${stepNum === 1 ? "rounded-l" : ""} 
                      ${stepNum === 3 ? "rounded-r" : ""}`}
                  ></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step content */}
        {renderStep()}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={step === 1}
            >
              Back
            </Button>

            {step < 3 ? (
              <Button onClick={handleNextStep}>Continue</Button>
            ) : (
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Project"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
