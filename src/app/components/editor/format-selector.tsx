"use client";

import {
  useVideoFormat,
  VIDEO_FORMATS,
  VideoFormat,
} from "@/app/contexts/format-context";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

export default function FormatSelector() {
  const { currentFormat, setFormat, formatDetails } = useVideoFormat();

  const handleFormatChange = (value: string) => {
    setFormat(value as VideoFormat);
  };

  return (
    <div className="flex gap-2 items-center">
      <div className="text-sm font-medium">Video Format:</div>
      <Select value={currentFormat} onValueChange={handleFormatChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select Format" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(VIDEO_FORMATS).map(([format, details]) => (
            <SelectItem key={format} value={format}>
              {details.name} ({format})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="ml-2 text-xs text-muted-foreground">
        {formatDetails.width}×{formatDetails.height}
      </div>
    </div>
  );
}
