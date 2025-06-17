/* eslint-disable max-params */
/* eslint-disable max-depth */
/* eslint-disable no-console */
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import fetch from "node-fetch";

import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  getSignedUrl,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  s3,
} from "@/lib/s3";

const pipelineAsync = promisify(pipeline);
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for multipart upload

interface UploadTask {
  bucket: string;
  bucketKey: string;
  filePath: string;
}

class S3Utils {
  // PMax bucket URLs - using new bucket names for this project
  public readonly s3PublicUrl: string =
    "https://s3.eu-central-1.wasabisys.com/pmax-assets";
  public readonly s3ImageUrl: string =
    "https://s3.eu-central-1.wasabisys.com/pmax-images";
  public readonly s3VideoUrl: string =
    "https://s3.eu-central-1.wasabisys.com/pmax-videos";
  public readonly s3AudioUrl: string =
    "https://s3.eu-central-1.wasabisys.com/pmax-audio";
  public readonly s3ExportsUrl: string =
    "https://s3.eu-central-1.wasabisys.com/pmax-exports";

  // PMax bucket names
  public readonly buckets = {
    images: "pmax-images",
    videos: "pmax-videos",
    audio: "pmax-audio",
    assets: "pmax-assets", // General assets
    exports: "pmax-exports", // Rendered video exports
  };

  private async ensureBucketExists(bucket: string) {
    try {
      // Check if bucket exists
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        console.log(`Creating bucket: ${bucket}`);
        try {
          await s3.send(new CreateBucketCommand({ Bucket: bucket }));
          console.log(`Successfully created bucket: ${bucket}`);
        } catch (createError) {
          console.error(`Failed to create bucket ${bucket}:`, createError);
          throw createError;
        }
      } else {
        console.error(`Error checking bucket ${bucket}:`, error);
        throw error;
      }
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.error(
          `Attempt ${attempt}/${maxRetries} failed:`,
          error.message || error
        );

        if (attempt < maxRetries) {
          // Exponential backoff: delay * 2^attempt
          const backoffDelay = delayMs * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${backoffDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    throw lastError;
  }

  public extractBucketAndKeyFromUrl(url: string): {
    bucket: string;
    bucketKey: string;
  } {
    try {
      // Decode the URL once
      const decodedUrl = decodeURIComponent(url);

      // Parse the URL to remove query parameters
      const urlObject = new URL(decodedUrl);
      urlObject.search = ""; // Remove the query string

      // Get the clean URL without query parameters
      const cleanUrl = urlObject.href;

      // Extract path components
      const pathParts = urlObject.pathname.split("/").filter(Boolean);

      // Extract bucket from hostname - for Wasabi, it's typically the first subdomain
      const hostnameParts = urlObject.hostname.split(".");
      const bucket =
        hostnameParts[0] === "s3" ? pathParts[0] : hostnameParts[0];

      // Get the key from the path
      // For path-style URLs (s3.region.wasabisys.com/bucket/key), skip the bucket part
      // For virtual-hosted style URLs (bucket.s3.region.wasabisys.com/key), use all path parts
      const bucketKey =
        hostnameParts[0] === "s3"
          ? pathParts.slice(1).join("/")
          : pathParts.join("/");

      // Log for debugging
      console.log("[extractBucketAndKeyFromUrl] Extracted values:", {
        bucket,
        bucketKey,
        originalUrl: url,
        decodedUrl,
        cleanUrl,
      });

      return {
        bucket,
        bucketKey,
      };
    } catch (error) {
      console.error("[extractBucketAndKeyFromUrl] Error parsing URL:", {
        error,
        url,
      });
      throw new Error(`Failed to parse S3 URL: ${url}`);
    }
  }

  private async uploadWithStream(
    bucket: string,
    bucketKey: string,
    filePath: string
  ) {
    const readStream = fs.createReadStream(filePath, {
      highWaterMark: CHUNK_SIZE,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: bucketKey,
      Body: readStream,
      ContentType: this.getContentType(bucketKey),
    });

    await s3.send(command);
  }

  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    const contentTypes: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      m4a: "audio/mp4",
      json: "application/json",
      txt: "text/plain",
    };
    return contentTypes[ext || ""] || "application/octet-stream";
  }

  public async batchUpload(tasks: UploadTask[], concurrency = 3) {
    const chunks: UploadTask[][] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
      chunks.push(tasks.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((task) =>
          this.retryOperation(() =>
            this.uploadWithStream(task.bucket, task.bucketKey, task.filePath)
          )
        )
      );
    }
  }

  public async uploadToS3(bucket: string, bucketKey: string, filePath: string) {
    console.log("[uploadToS3] Starting upload:", {
      bucket,
      bucketKey,
      filePath,
    });

    // Check if file exists and has content
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0) {
        throw new Error(`File is empty: ${filePath}`);
      }
      console.log(`[uploadToS3] File size: ${stats.size} bytes`);
    } catch (error) {
      console.error("[uploadToS3] Error checking file:", error);
      throw new Error(`File not found or inaccessible: ${filePath}`);
    }

    await this.retryOperation(async () => {
      // Ensure bucket exists before uploading
      await this.ensureBucketExists(bucket);
      await this.uploadWithStream(bucket, bucketKey, filePath);

      // Verify the upload was successful
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: bucketKey,
      });

      try {
        const headResponse = await s3.send(headCommand);
        console.log("[uploadToS3] Upload verified:", {
          bucket,
          bucketKey,
          size: headResponse.ContentLength,
        });
      } catch (error) {
        console.error("[uploadToS3] Upload verification failed:", error);
        throw new Error("Upload verification failed");
      }

      console.log("[uploadToS3] Successfully uploaded to S3:", {
        bucket,
        bucketKey,
      });
    });
  }

  public async getPresignedUrl(bucket: string, bucketKey: string) {
    console.log("[getPresignedUrl] Generating presigned URL:", {
      bucket,
      bucketKey,
    });

    try {
      // If bucketKey contains presigned URL parameters, strip them
      let cleanKey = bucketKey;
      if (bucketKey.includes("?X-Amz-")) {
        cleanKey = bucketKey.split("?")[0];
      }
      // Decode any remaining encoded characters
      cleanKey = decodeURIComponent(cleanKey);

      // First check if the object exists using HeadObject (more efficient)
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: cleanKey,
      });

      try {
        const headResponse = await s3.send(headCommand);
        console.log("[getPresignedUrl] Object exists:", {
          bucket,
          key: cleanKey,
          contentLength: headResponse.ContentLength,
          lastModified: headResponse.LastModified,
        });
      } catch (error: any) {
        if (error.$metadata?.httpStatusCode === 404) {
          console.error("[getPresignedUrl] Object not found:", {
            bucket,
            originalKey: bucketKey,
            cleanKey,
          });
          throw new Error(
            `Asset not found in S3. Bucket: ${bucket}, Key: ${cleanKey}`
          );
        }
        throw error;
      }

      // Now generate the presigned URL
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: cleanKey,
      });

      const presignedUrl = await getSignedUrl(s3, command, {
        expiresIn: 7 * 24 * 60 * 60, // 7 days (AWS maximum)
      });

      console.log("[getPresignedUrl] Generated presigned URL:", {
        bucket,
        key: cleanKey,
        urlLength: presignedUrl.length,
        expiresIn: "7 days",
      });

      return presignedUrl;
    } catch (error) {
      console.error("[getPresignedUrl] Error generating presigned URL:", error);
      throw error;
    }
  }

  public async getPutPresignedUrl(
    bucket: string,
    bucketKey: string,
    contentType: string
  ) {
    console.log("[getPutPresignedUrl] Generating upload URL:", {
      bucket,
      bucketKey,
      contentType,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: bucketKey,
      ContentType: contentType,
    });

    try {
      // Generate presigned URL with 1 hour expiration for uploads
      const url = await getSignedUrl(s3, command, {
        expiresIn: 3600, // 1 hour in seconds
      });

      console.log("[getPutPresignedUrl] Generated upload URL:", {
        bucket,
        key: bucketKey,
        urlLength: url.length,
      });

      return url;
    } catch (error) {
      console.error(
        "[getPutPresignedUrl] Error generating upload URL:",
        error,
        {
          bucket,
          key: bucketKey,
        }
      );
      throw new Error("Failed to generate upload URL");
    }
  }

  public async uploadBufferToS3(
    bucket: string,
    bucketKey: string,
    buffer: Buffer,
    contentType: string
  ) {
    console.log("[uploadBufferToS3] Starting upload:", {
      bucket,
      bucketKey,
      bufferSize: buffer.length,
      contentType,
    });

    await this.retryOperation(async () => {
      // Ensure bucket exists before uploading
      await this.ensureBucketExists(bucket);

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: bucketKey,
        Body: buffer,
        ContentType: contentType,
      });

      await s3.send(command);
      console.log("[uploadBufferToS3] Successfully uploaded buffer to S3:", {
        bucket,
        bucketKey,
      });
    });
  }

  public async refreshPresignedUrl(
    bucket: string,
    bucketKey: string
  ): Promise<string> {
    console.log("[refreshPresignedUrl] Refreshing URL for:", {
      bucket,
      bucketKey,
    });

    try {
      return await this.retryOperation(
        async () => {
          try {
            return await this.getPresignedUrl(bucket, bucketKey);
          } catch (error: any) {
            // If the error is a 404, don't retry since it won't help
            if (error.message?.includes("Asset not found")) {
              throw error;
            }
            // For other errors, let retryOperation handle the retry
            console.error("[refreshPresignedUrl] Error during attempt:", error);
            throw error;
          }
        },
        3, // Max retries
        2000 // Initial delay of 2 seconds
      );
    } catch (error) {
      console.error("[refreshPresignedUrl] Error refreshing URL:", {
        error,
        bucket,
        bucketKey,
      });

      // Enhance error message with context
      if (error instanceof Error) {
        throw new Error(
          `Failed to refresh presigned URL: ${error.message}. ` +
            `Bucket: ${bucket}, Key: ${bucketKey}`
        );
      }
      throw error;
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      console.log(`Successfully deleted object: ${key} from bucket: ${bucket}`);
    } catch (error) {
      console.error(
        `Failed to delete object ${key} from bucket ${bucket}:`,
        error
      );
      throw error;
    }
  }

  public async deleteAssetFromUrl(assetUrl: string): Promise<void> {
    if (!assetUrl) return;

    try {
      // Extract bucket and key from URL
      const { bucket, bucketKey } = this.extractBucketAndKeyFromUrl(assetUrl);

      await this.deleteObject(bucket, bucketKey);
    } catch (error) {
      console.error(`Failed to delete asset from URL ${assetUrl}:`, error);
      throw error;
    }
  }

  // Alias method for compatibility
  public async deleteFile(fileUrl: string): Promise<void> {
    return this.deleteAssetFromUrl(fileUrl);
  }

  async copyObject(bucket: string, sourceKey: string, destinationKey: string) {
    await this.ensureBucketExists(bucket);

    try {
      // Use the CopyObjectCommand to copy the object within S3
      const command = new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: destinationKey,
      });

      await s3.send(command);
      console.log(
        `Successfully copied ${sourceKey} to ${destinationKey} in bucket ${bucket}`
      );
    } catch (error) {
      console.error(
        `Failed to copy object from ${sourceKey} to ${destinationKey}:`,
        error
      );
      throw error;
    }
  }

  // Helper method to get the correct bucket for an asset type
  public getBucketForAssetType(assetType: string): string {
    switch (assetType.toLowerCase()) {
      case "image":
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
        return this.buckets.images;
      case "video":
      case "mp4":
      case "webm":
      case "mov":
      case "avi":
        return this.buckets.videos;
      case "audio":
      case "mp3":
      case "wav":
      case "ogg":
      case "m4a":
        return this.buckets.audio;
      case "export":
      case "render":
        return this.buckets.exports;
      default:
        return this.buckets.assets;
    }
  }

  // Generate S3 URL for a given bucket and key
  public generateS3Url(bucket: string, key: string): string {
    return `https://s3.eu-central-1.wasabisys.com/${bucket}/${key}`;
  }

  /**
   * Generate a presigned URL for downloading from S3
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  public async generatePresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      const url = await getSignedUrl(s3, command, { expiresIn });
      console.log(`Generated presigned URL for ${bucket}/${key}`);
      return url;
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }

  /**
   * Parse S3 URL to extract bucket and key
   * @param s3Url S3 URL
   * @returns Object with bucket and key
   */
  public parseS3Url(s3Url: string): { bucket: string; key: string } {
    // Handle URLs like: https://s3.eu-central-1.wasabisys.com/bucket/key/path
    const url = new URL(s3Url);
    const pathParts = url.pathname.slice(1).split("/"); // Remove leading slash and split
    const bucket = pathParts[0];
    const key = pathParts.slice(1).join("/");

    return { bucket, key };
  }

  /**
   * Generate a presigned URL from an S3 URL
   * @param s3Url S3 URL
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  public async generatePresignedUrlFromS3Url(
    s3Url: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { bucket, key } = this.parseS3Url(s3Url);
    return this.generatePresignedUrl(bucket, key, expiresIn);
  }

  /**
   * Refresh an S3 URL to get a fresh presigned URL (server-side safe)
   * This method constructs the full API URL for server-side contexts
   */
  async refreshS3Url(url: string): Promise<string> {
    if (
      !url ||
      (!url.includes("wasabisys.com") &&
        !url.includes("amazonaws.com") &&
        !url.includes("s3."))
    ) {
      return url;
    }

    try {
      // Construct full URL for server-side context
      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.AUTH_URL ||
        "http://localhost:3000";
      const apiUrl = `${baseUrl}/api/s3/presigned-url`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.presignedUrl || url;
      }
    } catch (error) {
      console.error("[S3Utils.refreshS3Url] Error refreshing S3 URL:", error);
    }

    return url;
  }

  // Helper to generate a unique key for uploaded assets
  public generateAssetKey(
    userId: string,
    filename: string,
    assetType?: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = filename.split(".").pop() || "";
    const baseName = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_");

    const folder = assetType ? `${assetType}/` : "";
    return `${folder}${userId}/${timestamp}_${randomId}_${baseName}.${extension}`;
  }

  // Download external image/video and upload to S3
  public async downloadAndUploadToS3(
    externalUrl: string,
    userId: string,
    assetType: "image" | "video" | "audio" = "image",
    filename?: string
  ): Promise<string> {
    console.log("[downloadAndUploadToS3] Starting download and upload:", {
      externalUrl,
      userId,
      assetType,
      filename,
    });

    try {
      // Download the file from external URL
      const response = await fetch(externalUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Get the buffer
      const buffer = await response.buffer();

      // Generate filename if not provided
      const finalFilename =
        filename ||
        `generated_${assetType}_${Date.now()}.${this.getExtensionFromUrl(externalUrl) || "jpg"}`;

      // Generate S3 key
      const bucket = this.getBucketForAssetType(assetType);
      const key = this.generateAssetKey(userId, finalFilename, assetType);

      // Get content type
      const contentType = this.getContentType(finalFilename);

      // Upload to S3
      await this.uploadBufferToS3(bucket, key, buffer, contentType);

      // Generate and return S3 URL
      const s3Url = this.generateS3Url(bucket, key);

      console.log("[downloadAndUploadToS3] Successfully uploaded to S3:", {
        bucket,
        key,
        s3Url,
        bufferSize: buffer.length,
      });

      return s3Url;
    } catch (error) {
      console.error("[downloadAndUploadToS3] Error:", error);
      throw new Error(
        `Failed to download and upload to S3: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Extract file extension from URL
  private getExtensionFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split(".");
      return parts.length > 1 ? parts[parts.length - 1] : null;
    } catch {
      return null;
    }
  }
}

export const s3Utils = new S3Utils();
