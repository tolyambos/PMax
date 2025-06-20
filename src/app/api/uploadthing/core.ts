import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    // Set permissions and file types for this FileRoute
    .middleware(async () => {
      // This code runs on your server before upload
      const { userId } = auth();

      // If you throw, the user will not be able to upload
      if (!userId) throw new Error("Unauthorized");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Create a record in the database
      const asset = await prisma.asset.create({
        data: {
          userId: metadata.userId,
          name: file.name,
          type: "image",
          url: file.url,
          thumbnail: file.url,
          tags: [], // Empty array for tags
        },
      });

      return { assetId: asset.id };
    }),

  videoUploader: f({ video: { maxFileSize: "16MB" } })
    .middleware(async () => {
      const { userId } = auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const asset = await prisma.asset.create({
        data: {
          userId: metadata.userId,
          name: file.name,
          type: "video",
          url: file.url,
          thumbnail: "", // In production, would generate thumbnail from video
          tags: [],
        },
      });

      return { assetId: asset.id };
    }),

  audioUploader: f({ audio: { maxFileSize: "8MB" } })
    .middleware(async () => {
      const { userId } = auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const asset = await prisma.asset.create({
        data: {
          userId: metadata.userId,
          name: file.name,
          type: "audio",
          url: file.url,
          tags: [],
        },
      });

      return { assetId: asset.id };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
