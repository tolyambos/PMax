import { Progress } from "@/app/components/ui/progress";
import { Loader2 } from "lucide-react";

interface GenerationProgressProps {
  progress: number;
  currentVideo?: {
    id: string;
    index: number;
    text: string;
  } | null;
  estimatedTime?: number;
}

export function GenerationProgress({
  progress,
  currentVideo,
  estimatedTime,
}: GenerationProgressProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="font-medium text-gray-900 dark:text-white">Generating videos...</span>
        </div>
        <span className="text-gray-600 dark:text-gray-400">{Math.round(progress)}% complete</span>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <div>
          {currentVideo ? (
            <>
              Processing video #{currentVideo.index}: {currentVideo.text}
            </>
          ) : (
            "Preparing generation..."
          )}
        </div>
        {estimatedTime && (
          <div>Est. time remaining: {estimatedTime} min</div>
        )}
      </div>
    </div>
  );
}