import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { s3Utils } from "@/lib/s3-utils";
import { s3, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@/lib/s3";

// POST /api/bulk-video/test-s3-access - Test S3 access and permissions
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const results: any = {
      url,
      tests: {},
    };

    // Extract bucket and key
    const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(url);
    results.bucket = bucket;
    results.bucketKey = bucketKey;

    // Test 1: Check if object exists
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: bucketKey,
      });
      const headResponse = await s3.send(headCommand);
      results.tests.headObject = {
        success: true,
        contentLength: headResponse.ContentLength,
        contentType: headResponse.ContentType,
        lastModified: headResponse.LastModified,
      };
    } catch (error: any) {
      results.tests.headObject = {
        success: false,
        error: error.message,
        code: error.$metadata?.httpStatusCode,
      };
    }

    // Test 2: Generate presigned URL
    try {
      const presignedUrl = await s3Utils.getPresignedUrl(bucket, bucketKey, true);
      results.tests.presignedUrl = {
        success: true,
        urlLength: presignedUrl.length,
        urlSample: presignedUrl.substring(0, 200) + "...",
      };

      // Test 3: Try to fetch with presigned URL
      try {
        const response = await fetch(presignedUrl, {
          method: "HEAD",
        });
        results.tests.fetchPresigned = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: {
            contentType: response.headers.get("content-type"),
            contentLength: response.headers.get("content-length"),
            accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
          },
        };
      } catch (error: any) {
        results.tests.fetchPresigned = {
          success: false,
          error: error.message,
        };
      }
    } catch (error: any) {
      results.tests.presignedUrl = {
        success: false,
        error: error.message,
      };
    }

    // Test 4: List objects in the bucket (to test general access)
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: bucketKey.split('/').slice(0, -1).join('/'),
        MaxKeys: 5,
      });
      const listResponse = await s3.send(listCommand);
      results.tests.listObjects = {
        success: true,
        keyCount: listResponse.KeyCount,
        isTruncated: listResponse.IsTruncated,
      };
    } catch (error: any) {
      results.tests.listObjects = {
        success: false,
        error: error.message,
        code: error.$metadata?.httpStatusCode,
      };
    }

    // Test 5: Try direct GetObject (this will likely fail but shows the error)
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: bucketKey,
      });
      const getResponse = await s3.send(getCommand);
      results.tests.getObject = {
        success: true,
        contentType: getResponse.ContentType,
        contentLength: getResponse.ContentLength,
      };
    } catch (error: any) {
      results.tests.getObject = {
        success: false,
        error: error.message,
        code: error.$metadata?.httpStatusCode,
      };
    }

    // Check environment variables
    results.environment = {
      hasAccessKey: !!process.env.WASABI_ACCESS_KEY,
      hasSecretKey: !!process.env.WASABI_SECRET_ACCESS_KEY,
      endpoint: "https://s3.eu-central-1.wasabisys.com",
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error("S3 access test error:", error);
    return NextResponse.json(
      { 
        error: "Failed to test S3 access",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}