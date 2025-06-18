import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const { userId: clerkUserId } = auth();

  try {
    if (clerkUserId) {
      // Find user by clerkId
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (user) {
        return {
          prisma,
          userId: user.id,
        };
      } else {
        // User exists in Clerk but not in database
        // This will be handled by the webhook or manual sync
        console.log("User not found in database, needs sync:", clerkUserId);
        return {
          prisma,
          userId: null,
        };
      }
    }

    return {
      prisma,
      userId: null,
    };
  } catch (error) {
    console.error("Error setting up tRPC context:", error);
    return {
      prisma,
      userId: null,
    };
  }
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    console.log("⚠️ tRPC Error:", error.message);
    if (error.cause) {
      console.log("⚠️ tRPC Error cause:", error.cause);
    }

    // For input validation errors, provide more detailed logging
    if (error.code === "BAD_REQUEST" && error.cause instanceof ZodError) {
      console.log("⚠️ tRPC Validation Error Details:", error.cause.errors);
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
