import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { runwareService } from "@/app/utils/runware";
import { z } from "zod";

// Store job status in memory (in production, use Redis or database)
const jobStatus = new Map<
  string,
  {
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    result?: any;
    error?: string;
    startTime: number;
    projectId?: string;
  }
>();

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const jobId = `project_${clerkUserId}_${Date.now()}`;

    // Initialize job status
    jobStatus.set(jobId, {
      status: "pending",
      progress: 0,
      startTime: Date.now(),
    });

    // Start background job (don't await)
    processProjectGeneration(jobId, body, clerkUserId).catch((error) => {
      console.error(`Background job ${jobId} failed:`, error);
      jobStatus.set(jobId, {
        status: "failed",
        progress: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        startTime: Date.now(),
      });
    });

    // Return job ID immediately
    return NextResponse.json({
      jobId,
      status: "pending",
      message: "Project generation started in background",
    });
  } catch (error) {
    console.error("Background project generation error:", error);
    return NextResponse.json(
      { error: "Failed to start background generation" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    const job = jobStatus.get(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Job status check error:", error);
    return NextResponse.json(
      { error: "Failed to check job status" },
      { status: 500 }
    );
  }
}

// Define project schema (simplified)
const ProjectRequestSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  adType: z.string().min(1, "Ad type is required"),
  productName: z.string().optional(),
  targetAudience: z.string().optional(),
  keyPoints: z.string().optional(),
  format: z.string().default("9:16"),
  style: z.string().default("cinematic"),
  numScenes: z.number().min(1).max(10).default(3),
  totalDuration: z.number().min(3).max(60).default(9),
  animateAllScenes: z.boolean().default(true),
  animationProvider: z.enum(["bytedance", "runway"]).default("bytedance"),
  productImages: z
    .array(
      z.object({
        url: z.string(),
        visionAnalysis: z.string(),
      })
    )
    .optional(),
  isProductVideo: z.boolean().default(false),
});

async function processProjectGeneration(
  jobId: string,
  requestData: any,
  clerkUserId: string
) {
  try {
    // Update status to processing
    jobStatus.set(jobId, {
      status: "processing",
      progress: 10,
      startTime: Date.now(),
    });

    // Validate input
    const validatedData = ProjectRequestSchema.parse(requestData);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { permissions: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const updateProgress = (progress: number) => {
      const current = jobStatus.get(jobId);
      if (current) {
        jobStatus.set(jobId, { ...current, progress });
      }
    };

    updateProgress(20);

    // Generate simple storyboard data
    const storyboardData = {
      scenes: Array.from({ length: validatedData.numScenes }, (_, index) => ({
        order: index,
        duration: Math.ceil(
          validatedData.totalDuration / validatedData.numScenes
        ),
        prompt: `${validatedData.description || validatedData.name} - Scene ${index + 1}`,
        description: `Scene ${index + 1} for ${validatedData.name}`,
      })),
    };

    updateProgress(40);

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        userId: user.id,
        format: validatedData.format,
        duration: validatedData.totalDuration,
        scenes: {
          create: storyboardData.scenes.map((scene: any, index: number) => ({
            order: index,
            duration: Math.max(1, Math.min(scene.duration || 3, 25)), // Ensure duration is between 1-25 seconds
            imageUrl: null, // Initialize as null
            prompt: scene.prompt || scene.description || null, // Use null instead of empty string
            animationStatus: null, // Initialize as null
            animationPrompt: null, // Initialize as null
            videoUrl: null, // Initialize as null
          })),
        },
      },
      include: {
        scenes: {
          include: {
            elements: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    updateProgress(60);

    // Generate images for scenes if needed
    if (validatedData.animateAllScenes) {
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        updateProgress(60 + (i / project.scenes.length) * 30);

        try {
          const imageResponse = await runwareService.generateImage({
            format: validatedData.format as "9:16" | "16:9" | "1:1" | "4:5",
            prompt: scene.prompt || "Default scene",
            negativePrompt: "",
            width: validatedData.format === "16:9" ? 1920 : 1080,
            height: validatedData.format === "16:9" ? 1080 : 1920,
            numSamples: 1,
          });

          if (imageResponse.imageURL) {
            await prisma.scene.update({
              where: { id: scene.id },
              data: { imageUrl: imageResponse.imageURL },
            });
          }
        } catch (error) {
          console.error(
            `Failed to generate image for scene ${scene.id}:`,
            error
          );
        }
      }
    }

    updateProgress(100);

    // Mark job as completed with same format as main route
    const result = {
      projectId: project.id,
      name: project.name,
      description: project.description,
      format: project.format,
      scenes: project.scenes,
      success: true,
      timestamp: new Date().toISOString(),
    };

    jobStatus.set(jobId, {
      status: "completed",
      progress: 100,
      result: result,
      startTime: Date.now(),
      projectId: project.id,
    });
  } catch (error) {
    console.error(`Background job ${jobId} failed:`, error);
    jobStatus.set(jobId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      startTime: Date.now(),
    });
  }
}

// Cleanup old jobs (runs every 10 minutes)
setInterval(
  () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const entriesToDelete: string[] = [];
    jobStatus.forEach((job, jobId) => {
      if (job.startTime < oneHourAgo) {
        entriesToDelete.push(jobId);
      }
    });

    entriesToDelete.forEach((jobId) => {
      jobStatus.delete(jobId);
    });
  },
  10 * 60 * 1000
);
