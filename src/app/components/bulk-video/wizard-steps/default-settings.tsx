"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Slider } from "@/app/components/ui/slider";
import { Badge } from "@/app/components/ui/badge";
import { Settings, Video, Image as ImageIcon, Clock, Layers, Sparkles, Camera, Link, Wand2, FileText } from "lucide-react";
import { Checkbox } from "@/app/components/ui/checkbox";
import { BulkVideoProjectSettings } from "@/app/types/bulk-video";
import { cn } from "@/lib/utils";
import { ImageStyleSelector } from "@/app/components/bulk-video/image-style-selector";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { ANIMATION_TEMPLATES } from "@/app/utils/bulk-video/animation-templates";

interface DefaultSettingsStepProps {
  settings: Partial<BulkVideoProjectSettings>;
  onSettingsChange: (settings: Partial<BulkVideoProjectSettings>) => void;
}

const VIDEO_FORMATS = [
  { value: "1080x1920", label: "Vertical (9:16)", description: "TikTok, Stories" },
  { value: "1920x1080", label: "Horizontal (16:9)", description: "YouTube, TV" },
  { value: "1080x1080", label: "Square (1:1)", description: "Instagram Feed" },
];

const ANIMATION_PROVIDERS = [
  { value: "runway", label: "Runway", description: "High-quality cinematic animations" },
  { value: "bytedance", label: "Bytedance", description: "Fast and efficient animations" },
];

export function DefaultSettingsStep({
  settings,
  onSettingsChange,
}: DefaultSettingsStepProps) {
  const toggleFormat = (format: string) => {
    const currentFormats = settings.defaultFormats || [];
    const newFormats = currentFormats.includes(format)
      ? currentFormats.filter(f => f !== format)
      : [...currentFormats, format];
    
    onSettingsChange({
      ...settings,
      defaultFormats: newFormats,
    });
  };

  return (
    <Card className="dark:bg-gray-800/50 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Default Video Settings
        </CardTitle>
        <CardDescription>
          Configure default settings for all videos. Individual videos can override these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Output Formats */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Output Formats
          </Label>
          <div className="space-y-3">
            {VIDEO_FORMATS.map((format) => (
              <div
                key={format.value}
                onClick={() => toggleFormat(format.value)}
                className={cn(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 dark:hover:border-blue-700",
                  settings.defaultFormats?.includes(format.value)
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{format.label}</div>
                    <div className="text-sm text-gray-600">{format.description}</div>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    settings.defaultFormats?.includes(format.value)
                      ? "border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                  )}>
                    {settings.defaultFormats?.includes(format.value) && (
                      <div className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select all formats you want to generate. Each video will be rendered in all selected formats.
          </p>
        </div>

        {/* Video Style */}
        <div className="space-y-2">
          <Label htmlFor="video-style">
            Video Style
          </Label>
          <Input
            id="video-style"
            placeholder="e.g., modern product showcase, minimalist, energetic"
            value={settings.defaultVideoStyle || ""}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                defaultVideoStyle: e.target.value,
              })
            }
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Describe the overall visual style for your videos
          </p>
        </div>

        {/* Image Generation Style */}
        <div className="space-y-4">
          <Label htmlFor="image-style" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Image Generation Style
          </Label>
          
          {/* Style Preset Selector */}
          <ImageStyleSelector
            selectedPresetId={settings.defaultImageStylePreset}
            onPresetSelect={(presetId) =>
              onSettingsChange({
                ...settings,
                defaultImageStylePreset: presetId,
              })
            }
          />
          
          {/* Custom Style Input */}
          <div className="space-y-2">
            <Label htmlFor="custom-style" className="text-sm">
              Additional Style Details (Optional)
            </Label>
            <Textarea
              id="custom-style"
              placeholder="e.g., specific colors, materials, mood, or additional styling preferences"
              value={settings.defaultImageStyle || ""}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  defaultImageStyle: e.target.value,
                })
              }
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Combine with preset for best results. AI will merge preset and custom styles.
            </p>
          </div>
        </div>

        {/* Animation Provider */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Animation Provider
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {ANIMATION_PROVIDERS.map((provider) => (
              <button
                key={provider.value}
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    defaultAnimationProvider: provider.value as "runway" | "bytedance",
                  })
                }
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                  settings.defaultAnimationProvider === provider.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                    : "border-gray-200 dark:border-gray-600"
                )}
              >
                <div className="font-medium mb-1">{provider.label}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{provider.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ByteDance Animation Settings */}
        {settings.defaultAnimationProvider === 'bytedance' && (
          <>
            {/* Fixed Camera */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="camera-fixed"
                  checked={settings.defaultCameraFixed || false}
                  onCheckedChange={(checked) =>
                    onSettingsChange({
                      ...settings,
                      defaultCameraFixed: checked as boolean,
                    })
                  }
                />
                <Label
                  htmlFor="camera-fixed"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Fixed Camera Mode
                </Label>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">
                Keeps the camera stationary during animation, only animating the subject
              </p>
            </div>

            {/* Use End Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-end-image"
                  checked={settings.defaultUseEndImage || false}
                  onCheckedChange={(checked) =>
                    onSettingsChange({
                      ...settings,
                      defaultUseEndImage: checked as boolean,
                    })
                  }
                />
                <Label
                  htmlFor="use-end-image"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Link className="w-4 h-4" />
                  Use Same Image as End Frame
                </Label>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">
                Uses the source image as the end frame for smoother scene transitions
              </p>
              {settings.defaultUseEndImage && (
                <p className="text-sm text-amber-600 dark:text-amber-400 ml-6 mt-1">
                  ⚠️ Note: When using end frame, videos will be generated at 720p instead of 1080p due to ByteDance limitations
                </p>
              )}
            </div>
          </>
        )}

        {/* Animation Prompt Mode */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Animation Prompt Generation
          </Label>
          <RadioGroup 
            value={settings.defaultAnimationPromptMode || 'ai'}
            onValueChange={(value) => 
              onSettingsChange({
                ...settings,
                defaultAnimationPromptMode: value as 'ai' | 'template',
              })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai" id="ai-prompt" />
              <Label htmlFor="ai-prompt" className="font-normal cursor-pointer">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  AI-Generated Prompts
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically generate unique animation prompts based on each product
                </p>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="template" id="template-prompt" />
              <Label htmlFor="template-prompt" className="font-normal cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Use Template Prompts
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose from pre-defined animation templates for consistent motion
                </p>
              </Label>
            </div>
          </RadioGroup>

          {/* Template Selection */}
          {settings.defaultAnimationPromptMode === 'template' && (
            <div className="space-y-3 mt-4">
              <Label>Select Animation Template</Label>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {ANIMATION_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() =>
                      onSettingsChange({
                        ...settings,
                        defaultAnimationTemplate: template.id,
                      })
                    }
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                      settings.defaultAnimationTemplate === template.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                        : "border-gray-200 dark:border-gray-600"
                    )}
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {template.description}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                      "{template.prompt}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scene Duration */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Scene Duration
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  defaultDuration: 5,
                })
              }
              className={cn(
                "p-4 rounded-lg border-2 text-center transition-all",
                "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                settings.defaultDuration === 5
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-600"
              )}
            >
              <div className="text-2xl font-bold mb-1">5s</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Quick & Snappy</div>
            </button>
            <button
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  defaultDuration: 10,
                })
              }
              className={cn(
                "p-4 rounded-lg border-2 text-center transition-all",
                "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                settings.defaultDuration === 10
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-600"
              )}
            >
              <div className="text-2xl font-bold mb-1">10s</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Standard Length</div>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select the duration for each scene in your video
          </p>
        </div>

        {/* Scene Count */}
        <div className="space-y-4">
          <Label htmlFor="scene-count" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Number of Scenes
          </Label>
          <div className="flex items-center gap-4">
            <Slider
              id="scene-count"
              min={1}
              max={10}
              step={1}
              value={[settings.defaultSceneCount || 3]}
              onValueChange={([value]) =>
                onSettingsChange({
                  ...settings,
                  defaultSceneCount: value,
                })
              }
              className="flex-1"
            />
            <Badge variant="secondary" className="min-w-[60px] justify-center">
              {settings.defaultSceneCount || 3} scenes
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total video duration: {(settings.defaultDuration || 5) * (settings.defaultSceneCount || 3)} seconds
          </p>
        </div>
      </CardContent>
    </Card>
  );
}