"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { 
  FileSpreadsheet, 
  Upload, 
  Link, 
  Download,
  CheckCircle,
  AlertCircle,
  Table,
  FileText
} from "lucide-react";
import { useToast } from "@/app/components/ui/use-toast";
import { DataSourceType, BulkVideoData } from "@/app/types/bulk-video";
import { parseCSVFile, parseXLSXFile, generateSampleCSV, generateSampleXLSX } from "@/app/utils/bulk-video/csv-parser";
import { cn } from "@/lib/utils";

interface DataImportStepProps {
  dataSource: {
    type: DataSourceType;
    file?: File;
    sheetsUrl?: string;
    videos: BulkVideoData[];
  };
  onDataSourceChange: (dataSource: any) => void;
}

export function DataImportStep({
  dataSource,
  onDataSourceChange,
}: DataImportStepProps) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [sheetsUrlInput, setSheetsUrlInput] = useState(dataSource.sheetsUrl || "");
  const debounceTimer = useRef<NodeJS.Timeout>();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setParseWarnings([]);

    try {
      let result;
      if (file.name.toLowerCase().endsWith('.csv')) {
        result = await parseCSVFile(file);
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        result = await parseXLSXFile(file);
      } else {
        throw new Error("Unsupported file format. Please upload CSV or XLSX file.");
      }

      if (result.success && result.data) {
        onDataSourceChange({
          ...dataSource,
          type: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx',
          file,
          videos: result.data,
        });

        if (result.warnings) {
          setParseWarnings(result.warnings);
        }

        toast({
          title: "File parsed successfully",
          description: `Found ${result.data.length} videos to generate`,
        });
      } else {
        throw new Error(result.error || "Failed to parse file");
      }
    } catch (error) {
      console.error("File parsing error:", error);
      toast({
        title: "Failed to parse file",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const fetchSheetsData = async (url: string) => {
    onDataSourceChange({
      ...dataSource,
      type: 'google-sheets',
      sheetsUrl: url,
      videos: [], // Clear videos while loading
    });

    if (!url || !url.includes('docs.google.com/spreadsheets')) {
      return;
    }

    setParsing(true);
    setParseWarnings([]);

    try {
      // Extract spreadsheet ID from URL
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error('Invalid Google Sheets URL');
      }
      const spreadsheetId = match[1];

      // Try to fetch the sheet data
      const response = await fetch('/api/bulk-video/preview-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetsUrl: url, spreadsheetId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch sheet data');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        onDataSourceChange({
          ...dataSource,
          type: 'google-sheets',
          sheetsUrl: url,
          videos: result.data,
        });

        if (result.warnings) {
          setParseWarnings(result.warnings);
        }

        toast({
          title: "Sheet loaded successfully",
          description: `Found ${result.data.length} videos to generate`,
        });
      } else {
        throw new Error(result.error || 'Failed to parse sheet');
      }
    } catch (error) {
      console.error('Google Sheets preview error:', error);
      toast({
        title: "Failed to load Google Sheet",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      
      // Keep the URL but clear videos
      onDataSourceChange({
        ...dataSource,
        type: 'google-sheets',
        sheetsUrl: url,
        videos: [],
      });
    } finally {
      setParsing(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-video-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSampleXLSX = () => {
    const xlsxBlob = generateSampleXLSX();
    const url = URL.createObjectURL(xlsxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-video-sample.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSample = () => {
    if (dataSource.type === 'xlsx') {
      downloadSampleXLSX();
    } else if (dataSource.type === 'csv') {
      downloadSampleCSV();
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <Card className="dark:bg-gray-800/50 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Data Import
        </CardTitle>
        <CardDescription>
          Upload your data source with video information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Data Source Type Selection */}
        <div className="space-y-4">
          <Label>Choose Data Source</Label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onDataSourceChange({ ...dataSource, type: 'csv' })}
              className={cn(
                "p-4 rounded-lg border-2 transition-all",
                "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                dataSource.type === 'csv'
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-600"
              )}
            >
              <FileText className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
              <div className="text-sm font-medium">CSV File</div>
            </button>
            <button
              onClick={() => onDataSourceChange({ ...dataSource, type: 'xlsx' })}
              className={cn(
                "p-4 rounded-lg border-2 transition-all",
                "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                dataSource.type === 'xlsx'
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-600"
              )}
            >
              <Table className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
              <div className="text-sm font-medium">Excel File</div>
            </button>
            <button
              onClick={() => onDataSourceChange({ ...dataSource, type: 'google-sheets' })}
              className={cn(
                "p-4 rounded-lg border-2 transition-all",
                "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-700",
                dataSource.type === 'google-sheets'
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-600"
              )}
            >
              <Link className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
              <div className="text-sm font-medium">Google Sheets</div>
            </button>
          </div>
        </div>

        {/* File Upload or Sheets URL */}
        {dataSource.type !== 'google-sheets' ? (
          <div className="space-y-4">
            <Label>Upload File</Label>
            {dataSource.file ? (
              <div className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium">{dataSource.file.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {dataSource.videos.length} videos found
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    Change File
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Click to upload your {dataSource.type.toUpperCase()} file
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Make sure your file has the required columns
                </p>
              </div>
            )}
            <input
              id="file-upload"
              type="file"
              accept={dataSource.type === 'csv' ? '.csv' : '.xlsx,.xls'}
              className="hidden"
              onChange={handleFileUpload}
              disabled={parsing}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Label htmlFor="sheets-url">Google Sheets URL</Label>
            <div className="space-y-2">
              <Input
                id="sheets-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetsUrlInput}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  setSheetsUrlInput(newUrl);
                  
                  // Clear existing timer
                  if (debounceTimer.current) {
                    clearTimeout(debounceTimer.current);
                  }
                  
                  // Set new timer to fetch after user stops typing
                  if (newUrl && newUrl.includes('docs.google.com/spreadsheets')) {
                    debounceTimer.current = setTimeout(() => {
                      fetchSheetsData(newUrl);
                    }, 1000); // Wait 1 second after user stops typing
                  } else {
                    // Clear data if URL is invalid
                    onDataSourceChange({
                      ...dataSource,
                      type: 'google-sheets',
                      sheetsUrl: newUrl,
                      videos: [],
                    });
                  }
                }}
                disabled={parsing}
              />
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  Loading sheet data...
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Make sure the sheet is publicly accessible or shared with our service account
            </p>
          </div>
        )}

        {/* Parse Warnings */}
        {parseWarnings.length > 0 && (
          <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription>
              <div className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Warnings:</div>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                {parseWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Data Preview */}
        {dataSource.videos.length > 0 && (
          <div className="space-y-4">
            <Label>Data Preview</Label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Text Content</th>
                    <th className="px-4 py-2 text-left">Product Image</th>
                    <th className="px-4 py-2 text-left">Custom Settings</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSource.videos.slice(0, 5).map((video, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2 max-w-xs truncate">
                        {video.textContent}
                      </td>
                      <td className="px-4 py-2">
                        {video.productImageUrl ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {(video.customFormats?.length || 0) +
                          (video.customDuration ? 1 : 0) +
                          (video.customSceneCount ? 1 : 0)} custom
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dataSource.videos.length > 5 && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400 text-center">
                  And {dataSource.videos.length - 5} more videos...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sample File Download */}
        {dataSource.type !== 'google-sheets' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Need a template?</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Download our sample {dataSource.type === 'xlsx' ? 'Excel' : 'CSV'} file to see the required format and columns.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSample}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Sample {dataSource.type === 'xlsx' ? 'Excel' : 'CSV'}
            </Button>
          </div>
        )}

        {/* Google Sheets Instructions */}
        {dataSource.type === 'google-sheets' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Google Sheets Setup</h4>
            <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
              <li>1. Create a Google Sheet with the required columns</li>
              <li>2. Make the sheet publicly accessible (Anyone with link can view)</li>
              <li>3. Copy the sharing URL and paste it above</li>
              <li>4. Ensure the first sheet contains your data</li>
            </ol>
            <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              Note: Private sheets require service account setup. Contact support for enterprise integration.
            </div>
          </div>
        )}

        {/* Required Columns Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">Required column:</div>
            <ul className="text-sm space-y-1">
              <li>• <code>text_content</code> - Main text for each video</li>
            </ul>
            <div className="font-medium mt-3 mb-2">Optional columns:</div>
            <ul className="text-sm space-y-1">
              <li>• <code>product_image</code> - URL to product image</li>
              <li>• <code>image_style</code> - Custom image generation style</li>
              <li>• <code>video_formats</code> - Comma-separated formats (e.g., "1080x1920,1920x1080")</li>
              <li>• <code>animation_provider</code> - "runway" or "bytedance"</li>
              <li>• <code>duration</code> - Scene duration in seconds (5 or 10)</li>
              <li>• <code>scene_count</code> - Number of scenes (1-10)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}