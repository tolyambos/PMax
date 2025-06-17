import { s3Utils } from "../src/lib/s3-utils.js";
import { CreateBucketCommand, HeadBucketCommand, s3 } from "../src/lib/s3.js";

async function setupS3Buckets() {
  console.log("🚀 Setting up S3 buckets for PMax...");

  const buckets = [
    s3Utils.buckets.images,
    s3Utils.buckets.videos,
    s3Utils.buckets.audio,
    s3Utils.buckets.assets,
    s3Utils.buckets.exports,
  ];

  for (const bucket of buckets) {
    try {
      console.log(`📦 Checking bucket: ${bucket}`);
      
      // Check if bucket exists
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`✅ Bucket ${bucket} already exists`);
      
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        console.log(`🔨 Creating bucket: ${bucket}`);
        try {
          await s3.send(new CreateBucketCommand({ Bucket: bucket }));
          console.log(`✅ Successfully created bucket: ${bucket}`);
        } catch (createError) {
          console.error(`❌ Failed to create bucket ${bucket}:`, createError);
          throw createError;
        }
      } else {
        console.error(`❌ Error checking bucket ${bucket}:`, error);
        throw error;
      }
    }
  }

  console.log("\n🎉 S3 bucket setup complete!");
  console.log("\n📋 Available buckets:");
  buckets.forEach((bucket) => {
    console.log(`  - ${bucket}`);
  });

  console.log("\n🔗 Bucket URLs:");
  console.log(`  - Images: ${s3Utils.s3ImageUrl}`);
  console.log(`  - Videos: ${s3Utils.s3VideoUrl}`);
  console.log(`  - Audio: ${s3Utils.s3AudioUrl}`);
  console.log(`  - Assets: ${s3Utils.s3PublicUrl}`);
  console.log(`  - Exports: ${s3Utils.s3ExportsUrl}`);
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupS3Buckets()
    .then(() => {
      console.log("\n✨ Setup completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Setup failed:", error);
      process.exit(1);
    });
}

export { setupS3Buckets };