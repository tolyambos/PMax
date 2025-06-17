# S3 Integration for PMax

This document outlines the complete S3 integration implementation for the PMax project using Wasabi S3-compatible storage.

## 🏗️ Architecture Overview

The S3 integration consists of several key components:

1. **S3 Configuration** (`src/lib/s3.ts`) - AWS SDK client configuration for Wasabi
2. **S3 Utilities** (`src/lib/s3-utils.ts`) - Comprehensive utility class for S3 operations
3. **React Components** - UI components for displaying and managing S3 assets
4. **API Endpoints** - Backend routes for S3 operations
5. **React Hooks** - Custom hooks for asset management

## 📦 S3 Buckets

The integration creates 5 dedicated buckets for different asset types:

- `pmax-images` - Image assets (jpg, png, gif, webp, svg)
- `pmax-videos` - Video assets (mp4, webm, mov, avi)
- `pmax-audio` - Audio assets (mp3, wav, ogg, m4a)
- `pmax-assets` - General assets and documents
- `pmax-exports` - Rendered video exports

## 🔧 Setup Instructions

### 1. Environment Variables

Add these variables to your `.env` file:

```bash
WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_ACCESS_KEY=your_wasabi_secret_key
```

### 2. Install Dependencies

The AWS SDK packages have been automatically installed:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 3. Update Database Schema

Run Prisma migration to add new S3 fields to the Asset model:

```bash
npx prisma db push
```

### 4. Create S3 Buckets

Run the bucket setup script:

```bash
npm run s3:setup
```

## 🚀 Usage Examples

### Using S3Asset Component

```tsx
import { S3AssetMemoized } from "@/components/S3Asset";

// Display an image from S3
<S3AssetMemoized
  url="https://s3.eu-central-1.wasabisys.com/pmax-images/user123/image.jpg"
  alt="My Image"
  width={300}
  height={200}
  className="rounded-lg"
/>

// Display a video from S3
<S3AssetMemoized
  url="https://s3.eu-central-1.wasabisys.com/pmax-videos/user123/video.mp4"
  alt="My Video"
  width={400}
  height={300}
  asVideo
  videoClassName="rounded-lg"
/>
```

### Using VideoS3Asset Component

```tsx
import { VideoS3Asset } from "@/components/S3Asset";

<VideoS3Asset
  url="https://s3.eu-central-1.wasabisys.com/pmax-videos/user123/video.mp4"
  className="w-full h-auto"
  autoPlay
  loop
  muted
/>
```

### Using S3UploadButton

```tsx
import { S3UploadButton } from "@/components/assets/s3-upload-button";

<S3UploadButton
  onUploadComplete={(asset) => console.log("Uploaded:", asset)}
  accept="image/*,video/*"
  multiple
>
  Upload Assets
</S3UploadButton>
```

### Using useS3Asset Hook

```tsx
import { useS3Asset } from "@/hooks/useS3Asset";

function MyComponent({ assetUrl, userId }) {
  const { url, isLoading, error, handleAssetError } = useS3Asset(assetUrl, userId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <img src={url} alt="Asset" onError={handleAssetError} />;
}
```

## 🔌 API Endpoints

### Upload Asset
```typescript
POST /api/s3/upload
Content-Type: multipart/form-data

Body: FormData with 'file', 'assetType', and optional 'tags'
```

### Get Presigned URL
```typescript
POST /api/s3/presigned-url
Content-Type: application/json

Body: { url: string, ownerId?: string }
```

### Refresh Presigned URL
```typescript
POST /api/s3/refresh-url
Content-Type: application/json

Body: { url: string, ownerId?: string }
```

### Delete Asset
```typescript
POST /api/s3/delete
Content-Type: application/json

Body: { url?: string, assetId?: string }
```

### Get Upload URL (for direct client upload)
```typescript
POST /api/s3/upload-url
Content-Type: application/json

Body: { filename: string, contentType: string, assetType?: string }
```

## 🛠️ Utility Functions

The `s3Utils` class provides comprehensive methods:

```typescript
import { s3Utils } from "@/lib/s3-utils";

// Upload file to S3
await s3Utils.uploadToS3(bucket, key, filePath);

// Upload buffer to S3
await s3Utils.uploadBufferToS3(bucket, key, buffer, contentType);

// Get presigned URL
const url = await s3Utils.getPresignedUrl(bucket, key);

// Delete asset
await s3Utils.deleteAssetFromUrl(assetUrl);

// Get bucket for asset type
const bucket = s3Utils.getBucketForAssetType("image");

// Generate asset key
const key = s3Utils.generateAssetKey(userId, filename, assetType);
```

## 📊 Database Schema Updates

The Asset model now includes additional S3-related fields:

```prisma
model Asset {
  id        String    @id @default(cuid())
  userId    String
  name      String
  type      String
  url       String
  thumbnail String?
  tags      String[]
  duration  Int?
  fileSize  Int?      // File size in bytes
  mimeType  String?   // MIME type of the file
  bucket    String?   // S3 bucket name
  s3Key     String?   // S3 object key
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  elements  Element[]
}
```

## 🔒 Security Features

- **Authentication Required**: All API endpoints require user authentication
- **User Ownership**: Users can only access/modify their own assets
- **Presigned URLs**: Secure temporary access to S3 objects (7-day expiration)
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
- **Retry Logic**: Built-in retry mechanism for failed operations

## 🚦 Error Handling

The integration includes robust error handling:

- **403 errors**: Silently handled (don't display to users)
- **404 errors**: Asset not found
- **Upload failures**: Detailed error messages
- **Network issues**: Automatic retry with exponential backoff
- **Validation errors**: Clear feedback for invalid inputs

## 🎯 Key Features

1. **Automatic Bucket Management**: Creates buckets automatically if they don't exist
2. **Smart Asset Categorization**: Routes assets to appropriate buckets based on file type
3. **Presigned URL Management**: Automatic URL refresh when assets fail to load
4. **Memory Optimization**: Memoized components prevent unnecessary re-renders
5. **Progress Tracking**: Upload progress and loading states
6. **Batch Operations**: Support for multiple file uploads
7. **File Size Tracking**: Monitors and displays file sizes
8. **MIME Type Detection**: Automatic content type detection
9. **Unique Key Generation**: Prevents filename conflicts with timestamp and random IDs
10. **Database Integration**: Seamless integration with existing Prisma schema

## 🔄 Migration from UploadThing

To migrate existing assets from UploadThing to S3:

1. Update existing upload components to use `S3UploadButton`
2. Replace `UploadButton` imports with S3 components
3. Update asset display components to use `S3AssetMemoized`
4. Run database migrations to add new S3 fields
5. Optionally migrate existing assets by downloading and re-uploading to S3

## 📈 Performance Optimizations

- **Memoized Components**: Prevent unnecessary re-renders
- **Lazy Loading**: Components only load assets when needed
- **Presigned URLs**: Direct browser-to-S3 communication (reduces server load)
- **Chunked Uploads**: Large files uploaded in chunks
- **Batch Operations**: Multiple files processed efficiently
- **Error Recovery**: Automatic retry for transient failures

## 🧪 Testing

To test the S3 integration:

1. Upload various file types (images, videos, audio)
2. Verify assets appear in correct S3 buckets
3. Test presigned URL generation and refresh
4. Verify asset deletion from both S3 and database
5. Test error scenarios (invalid files, network issues)
6. Check authentication and authorization
7. Verify mobile compatibility

This comprehensive S3 integration provides a robust, scalable asset management solution for the PMax application.