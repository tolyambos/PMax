import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Film, FileText } from "lucide-react";

interface ProjectBasicsStepProps {
  projectName: string;
  projectDescription: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}

export function ProjectBasicsStep({
  projectName,
  projectDescription,
  onNameChange,
  onDescriptionChange,
}: ProjectBasicsStepProps) {
  return (
    <Card className="dark:bg-gray-800/50 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="w-5 h-5" />
          Project Basics
        </CardTitle>
        <CardDescription>
          Set up your bulk video project details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="project-name">
            Project Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="project-name"
            placeholder="e.g., Holiday Product Campaign 2024"
            value={projectName}
            onChange={(e) => onNameChange(e.target.value)}
            className="text-lg"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose a descriptive name for your bulk video project
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Project Description
          </Label>
          <Textarea
            id="project-description"
            placeholder="Describe the purpose and goals of this bulk video campaign..."
            value={projectDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={4}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Optional: Add notes about your campaign objectives
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What is a Bulk Video Project?</h4>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Bulk video projects allow you to generate multiple videos at once using a data source 
            (CSV, Excel, or Google Sheets). Each row in your data will become a unique video with 
            consistent branding and styling.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}