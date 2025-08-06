import * as XLSX from 'xlsx';
import { BulkVideoData } from '@/app/types/bulk-video';

export interface ParseResult {
  success: boolean;
  data?: BulkVideoData[];
  error?: string;
  warnings?: string[];
}

export interface ColumnMapping {
  textContent: string;
  productImage?: string;
  imageStyle?: string;
  videoFormats?: string;
  animationProvider?: string;
  duration?: string;
  sceneCount?: string;
}

const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  textContent: 'text_content',
  productImage: 'product_image',
  imageStyle: 'image_style',
  videoFormats: 'video_formats',
  animationProvider: 'animation_provider',
  duration: 'duration',
  sceneCount: 'scene_count',
};

export async function parseCSVFile(
  file: File,
  columnMapping: ColumnMapping = DEFAULT_COLUMN_MAPPING
): Promise<ParseResult> {
  try {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    
    return parseData(jsonData, columnMapping);
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function parseXLSXFile(
  file: File,
  columnMapping: ColumnMapping = DEFAULT_COLUMN_MAPPING
): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    
    return parseData(jsonData, columnMapping);
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function parseData(data: string[][], columnMapping: ColumnMapping): ParseResult {
  if (data.length < 2) {
    return {
      success: false,
      error: 'File must contain at least a header row and one data row',
    };
  }

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const warnings: string[] = [];
  const videos: BulkVideoData[] = [];

  // Validate required columns
  const textContentIndex = headers.findIndex(h => h === columnMapping.textContent.toLowerCase());
  if (textContentIndex === -1) {
    return {
      success: false,
      error: `Required column "${columnMapping.textContent}" not found in file`,
    };
  }

  // Find optional column indices
  const columnIndices = {
    textContent: textContentIndex,
    productImage: columnMapping.productImage ? 
      headers.findIndex(h => h === columnMapping.productImage!.toLowerCase()) : -1,
    imageStyle: columnMapping.imageStyle ? 
      headers.findIndex(h => h === columnMapping.imageStyle!.toLowerCase()) : -1,
    videoFormats: columnMapping.videoFormats ? 
      headers.findIndex(h => h === columnMapping.videoFormats!.toLowerCase()) : -1,
    animationProvider: columnMapping.animationProvider ? 
      headers.findIndex(h => h === columnMapping.animationProvider!.toLowerCase()) : -1,
    duration: columnMapping.duration ? 
      headers.findIndex(h => h === columnMapping.duration!.toLowerCase()) : -1,
    sceneCount: columnMapping.sceneCount ? 
      headers.findIndex(h => h === columnMapping.sceneCount!.toLowerCase()) : -1,
  };

  // Parse data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Skip empty rows
    if (!row || row.length === 0 || !row[columnIndices.textContent]) {
      continue;
    }

    const textContent = String(row[columnIndices.textContent]).trim();
    if (!textContent) {
      warnings.push(`Row ${i + 1}: Skipped due to empty text content`);
      continue;
    }

    const video: BulkVideoData = {
      textContent,
    };

    // Parse optional fields
    if (columnIndices.productImage >= 0 && row[columnIndices.productImage]) {
      video.productImageUrl = String(row[columnIndices.productImage]).trim();
    }

    if (columnIndices.imageStyle >= 0 && row[columnIndices.imageStyle]) {
      video.customImageStyle = String(row[columnIndices.imageStyle]).trim();
    }

    if (columnIndices.videoFormats >= 0 && row[columnIndices.videoFormats]) {
      const formats = String(row[columnIndices.videoFormats])
        .split(',')
        .map(f => f.trim())
        .filter(f => f);
      if (formats.length > 0) {
        video.customFormats = formats;
      }
    }

    if (columnIndices.animationProvider >= 0 && row[columnIndices.animationProvider]) {
      const provider = String(row[columnIndices.animationProvider]).trim().toLowerCase();
      if (provider === 'runway' || provider === 'bytedance') {
        video.customAnimationProvider = provider;
      } else if (provider) {
        warnings.push(`Row ${i + 1}: Invalid animation provider "${provider}", using project default`);
      }
    }

    if (columnIndices.duration >= 0 && row[columnIndices.duration]) {
      const duration = parseInt(String(row[columnIndices.duration]), 10);
      if (!isNaN(duration) && duration > 0) {
        video.customDuration = duration;
      } else {
        warnings.push(`Row ${i + 1}: Invalid duration "${row[columnIndices.duration]}", using project default`);
      }
    }

    if (columnIndices.sceneCount >= 0 && row[columnIndices.sceneCount]) {
      const sceneCount = parseInt(String(row[columnIndices.sceneCount]), 10);
      if (!isNaN(sceneCount) && sceneCount > 0) {
        video.customSceneCount = sceneCount;
      } else {
        warnings.push(`Row ${i + 1}: Invalid scene count "${row[columnIndices.sceneCount]}", using project default`);
      }
    }

    videos.push(video);
  }

  if (videos.length === 0) {
    return {
      success: false,
      error: 'No valid data rows found in file',
    };
  }

  return {
    success: true,
    data: videos,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function generateSampleCSV(): string {
  const headers = [
    'text_content',
    'product_image',
    'image_style',
    'video_formats',
    'animation_provider',
    'duration',
    'scene_count',
  ];

  const sampleData = [
    [
      'Discover our premium wireless headphones with noise cancellation',
      'https://example.com/headphones.jpg',
      'modern tech product photography',
      '1080x1920,1920x1080',
      'runway',
      '15',
      '3',
    ],
    [
      'Experience the ultimate comfort with our ergonomic office chair',
      '',
      'minimalist furniture photography',
      '1080x1080',
      'bytedance',
      '12',
      '2',
    ],
    [
      'Transform your kitchen with our smart blender',
      'https://example.com/blender.jpg',
      '',
      '',
      '',
      '',
      '',
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export function generateSampleXLSX(): Blob {
  const headers = [
    'text_content',
    'product_image',
    'image_style',
    'video_formats',
    'animation_provider',
    'duration',
    'scene_count',
  ];

  const sampleData = [
    [
      'Discover our premium wireless headphones with noise cancellation',
      'https://example.com/headphones.jpg',
      'modern tech product photography',
      '1080x1920,1920x1080',
      'bytedance',
      '5',
      '3',
    ],
    [
      'Experience the ultimate comfort with our ergonomic office chair',
      '',
      'minimalist furniture photography',
      '1080x1080',
      'bytedance',
      '10',
      '2',
    ],
    [
      'Transform your kitchen with our smart blender',
      'https://example.com/blender.jpg',
      'sleek appliance photography',
      '1080x1920',
      'runway',
      '5',
      '4',
    ],
    [
      'Elevate your workout with our fitness tracker',
      '',
      'sporty and energetic',
      '',
      '',
      '',
      '',
    ],
  ];

  // Create worksheet data
  const wsData = [headers, ...sampleData];
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    const maxLength = Math.max(
      h.length,
      ...sampleData.map(row => row[i]?.length || 0)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Bulk Videos');
  
  // Generate XLSX file as array buffer
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
  // Convert to Blob
  return new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}