"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { 
  Settings, 
  Image as ImageIcon, 
  Move, 
  Ruler,
  Video,
  Clock,
  Layers,
  Sparkles,
  FileSpreadsheet
} from "lucide-react";
import { S3Image } from "./s3-image";

interface ProjectSettingsProps {
  project: any;
  onUpdate: () => void;
}

export function ProjectSettings({ project, onUpdate }: ProjectSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Brand Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Brand Configuration
          </CardTitle>
          <CardDescription>
            Logo settings applied to all videos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Brand Logo</h4>
              {project.settings.brandLogoUrl && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <S3Image
                    src={project.settings.brandLogoUrl}
                    alt="Brand logo"
                    className="max-h-24 mx-auto"
                    style={{ maxHeight: '6rem' }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Move className="w-4 h-4" />
                  Position
                </h4>
                <Badge variant="secondary">{project.settings.logoPosition}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Size
                </h4>
                <p className="text-sm">
                  {project.settings.logoSize.width} × {project.settings.logoSize.height}px
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Video Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Default Video Settings
          </CardTitle>
          <CardDescription>
            Settings used when not overridden per video
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Output Formats
                </h4>
                <div className="flex flex-wrap gap-2">
                  {project.settings.defaultFormats.map((format: string) => (
                    <Badge key={format} variant="outline">
                      {format}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Duration
                </h4>
                <p className="text-sm">{project.settings.defaultDuration} seconds</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Scene Count
                </h4>
                <p className="text-sm">{project.settings.defaultSceneCount} scenes</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Animation Provider
                </h4>
                <Badge variant="secondary">{project.settings.defaultAnimationProvider}</Badge>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Style</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {project.settings.defaultVideoStyle || "Not specified"}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image Style</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {project.settings.defaultImageStyle || "Not specified"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Data Source
          </CardTitle>
          <CardDescription>
            Original data used to create videos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</h4>
              <Badge variant="outline">{project.dataSourceType?.toUpperCase() || "Unknown"}</Badge>
            </div>
            {project.uploadedFileUrl && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Uploaded file stored</p>
              </div>
            )}
            {project.dataSourceUrl && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Sheets URL</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{project.dataSourceUrl}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Created:</span>
              <p className="font-medium">{new Date(project.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
              <p className="font-medium">{new Date(project.updatedAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Project ID:</span>
              <p className="font-mono text-xs">{project.id}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Storage:</span>
              <p className="font-medium">
                {project.stats.totalRenderedFiles} files
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}