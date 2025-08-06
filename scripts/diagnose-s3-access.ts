import { s3, GetObjectCommand, HeadObjectCommand } from "../src/lib/s3";
import { s3Utils } from "../src/lib/s3-utils";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function diagnoseS3Access() {
  console.log("=== S3 Access Diagnostics ===\n");

  // Test video URL from the logs
  const testUrl = "https://s3.eu-central-1.wasabisys.com/pmax-videos/bulk-videos/cmd0rsjyj000ab773f75oo9tx/cmd0rsjyn000gb773mprwlwiz-1080-1920-abbeb042-129d-4e4d-add8-f8770cae2ef0.mp4";

  console.log("1. Testing URL extraction...");
  const { bucket, bucketKey } = s3Utils.extractBucketAndKeyFromUrl(testUrl);
  console.log(`   Bucket: ${bucket}`);
  console.log(`   Key: ${bucketKey}\n`);

  console.log("2. Testing HeadObject...");
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: bucketKey,
    });
    const headResponse = await s3.send(headCommand);
    console.log("   ✓ Object exists");
    console.log(`   Size: ${headResponse.ContentLength} bytes`);
    console.log(`   Type: ${headResponse.ContentType}`);
    console.log(`   Last Modified: ${headResponse.LastModified}\n`);
  } catch (error: any) {
    console.log("   ✗ HeadObject failed:", error.message);
    console.log(`   Status: ${error.$metadata?.httpStatusCode}\n`);
  }

  console.log("3. Generating presigned URL...");
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: bucketKey,
    });
    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600, // 1 hour
    });
    console.log("   ✓ Presigned URL generated");
    console.log(`   URL: ${presignedUrl.substring(0, 100)}...\n`);

    console.log("4. Testing presigned URL access...");
    const response = await fetch(presignedUrl, {
      method: "HEAD",
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get("content-type")}`);
    console.log(`   Content-Length: ${response.headers.get("content-length")}`);
    console.log(`   CORS: ${response.headers.get("access-control-allow-origin") || "Not set"}\n`);

    if (response.status === 403) {
      console.log("5. Fetching error details...");
      const errorResponse = await fetch(presignedUrl);
      const errorText = await errorResponse.text();
      console.log("   Error response:");
      console.log(errorText.substring(0, 500));
    }
  } catch (error: any) {
    console.log("   ✗ Failed:", error.message);
  }

  console.log("\n6. Environment check...");
  console.log(`   WASABI_ACCESS_KEY: ${process.env.WASABI_ACCESS_KEY ? "Set" : "Not set"}`);
  console.log(`   WASABI_SECRET_ACCESS_KEY: ${process.env.WASABI_SECRET_ACCESS_KEY ? "Set" : "Not set"}`);
  console.log(`   S3 Endpoint: https://s3.eu-central-1.wasabisys.com`);
}

// Run diagnostics
diagnoseS3Access().catch(console.error);