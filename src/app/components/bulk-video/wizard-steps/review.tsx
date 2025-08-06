import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { 
  CheckCircle, 
  FileSpreadsheet, 
  Video, 
  Clock, 
  Layers,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  Wand2,
  FileText
} from "lucide-react";
import { BulkVideoProjectSettings, DataSourceType, BulkVideoData } from "@/app/types/bulk-video";
import { ANIMATION_TEMPLATES } from "@/app/utils/bulk-video/animation-templates";

interface ReviewStepProps {
  projectName: string;
  projectDescription: string;
  brandSettings: BulkVideoProjectSettings;
  dataSource: {
    type: DataSourceType;
    file?: File;
    sheetsUrl?: string;
    videos: BulkVideoData[];
  };
}

export function ReviewStep({
  projectName,
  projectDescription,
  brandSettings,
  dataSource,
}: ReviewStepProps) {
  const totalVideos = dataSource.videos.length;
  const totalFormats = brandSettings.defaultFormats.length;
  const totalOutputs = totalVideos * totalFormats;
  const estimatedTime = Math.ceil((totalVideos * 2) / 60); // Rough estimate: 2 min per video

  return (
    <div className="space-y-6">
      <Card className="dark:bg-gray-800/50 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Review & Generate
          </CardTitle>
          <CardDescription>
            Review your settings before starting the bulk video generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Summary */}
          <div>
            <h4 className="font-medium mb-3">Project Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Project Name:</span>
                <span className="font-medium">{projectName}</span>
              </div>
              {projectDescription && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Description:</span>
                  <span className="font-medium max-w-xs text-right">{projectDescription}</span>
                </div>
              )}
            </div>
          </div>

          {/* Brand Settings */}
          <div>
            <h4 className="font-medium mb-3">Brand Configuration</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Logo Position:</span>
                <Badge variant="secondary">{brandSettings.logoPosition}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Logo Size:</span>
                <span className="font-medium">
                  {brandSettings.logoSize.width} × {brandSettings.logoSize.height}px
                </span>
              </div>
            </div>
          </div>

          {/* Default Settings */}
          <div>
            <h4 className="font-medium mb-3">Default Video Settings</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Video className="w-4 h-4" />
                  <span>Formats:</span>
                </div>
                <div className="pl-6">
                  {brandSettings.defaultFormats.map((format) => (
                    <Badge key={format} variant="outline" className="mr-2 mb-1">
                      {format}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Duration: {brandSettings.defaultDuration}s</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Layers className="w-4 h-4" />
                  <span>Scenes: {brandSettings.defaultSceneCount}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Animation: {brandSettings.defaultAnimationProvider}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  {brandSettings.defaultAnimationPromptMode === 'template' ? (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Template: {
                        ANIMATION_TEMPLATES.find(t => t.id === brandSettings.defaultAnimationTemplate)?.name || 
                        brandSettings.defaultAnimationTemplate || 
                        'Not selected'
                      }</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Prompts: AI-Generated</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <ImageIcon className="w-4 h-4" />
                  <span>Image Style:</span>
                </div>
                <div className="pl-6 text-xs">
                  {brandSettings.defaultImageStyle}
                </div>
              </div>
            </div>
          </div>

          {/* Data Source */}
          <div>
            <h4 className="font-medium mb-3">Data Source</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Source Type:</span>
                <Badge variant="secondary">
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  {dataSource.type.toUpperCase()}
                </Badge>
              </div>
              {dataSource.file && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">File:</span>
                  <span className="font-medium">{dataSource.file.name}</span>
                </div>
              )}
              {dataSource.sheetsUrl && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Sheet URL:</span>
                  <span className="font-medium text-xs truncate max-w-xs">
                    {dataSource.sheetsUrl}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Generation Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-3">Generation Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-blue-700 dark:text-blue-400">Total Videos</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{totalVideos}</div>
              </div>
              <div>
                <div className="text-blue-700 dark:text-blue-400">Output Files</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{totalOutputs}</div>
              </div>
              <div>
                <div className="text-blue-700 dark:text-blue-400">Formats per Video</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{totalFormats}</div>
              </div>
              <div>
                <div className="text-blue-700 dark:text-blue-400">Est. Time</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">~{estimatedTime} min</div>
              </div>
            </div>
          </div>

          {/* Warning for large batches */}
          {totalVideos > 50 && (
            <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription>
                <span className="font-medium text-yellow-800 dark:text-yellow-300">Large batch detected:</span>{" "}
                <span className="text-yellow-700 dark:text-yellow-400">
                  Generating {totalVideos} videos may take considerable time. Videos will be 
                  processed in batches, and you can monitor progress in the project dashboard.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Ready to Generate */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <h4 className="font-medium text-green-900 dark:text-green-300 mb-1">
              Ready to Generate!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-400">
              Click "Generate Videos" to start creating your bulk video project.
              You'll be redirected to the project dashboard to monitor progress.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}