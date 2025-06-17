import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma } from "@/utils/db";

// In development, we'll use a simple mock authentication system
// This uses cookies to store the userId for server-side access
export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const { req } = opts;

  try {
    // For development, use a fixed dev user ID
    const devUserId = "dev-user-id";

    // Always ensure dev user exists in development
    if (process.env.NODE_ENV === "development") {
      try {
        // First check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { id: devUserId },
        });

        if (!existingUser) {
          console.log("Creating development user");
          await prisma.user.create({
            data: {
              id: devUserId,
              name: "Development User",
              email: "dev@example.com",
            },
          });
        }
      } catch (userError) {
        console.error("Error ensuring dev user exists:", userError);
        // Continue anyway
      }

      console.log("Using dev user for tRPC context");
      return {
        prisma,
        userId: devUserId,
      };
    }

    // For production, this would be replaced with actual auth
    return {
      prisma,
      userId: null,
    };
  } catch (error) {
    console.error("Error setting up tRPC context:", error);

    // Always return dev user in development
    if (process.env.NODE_ENV === "development") {
      return {
        prisma,
        userId: "dev-user-id", // Fallback for development
      };
    }

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
