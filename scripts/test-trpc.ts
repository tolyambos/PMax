import { TRPCError, initTRPC } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import superjson from 'superjson';
import { z } from 'zod';

// Initialize Prisma
const prisma = new PrismaClient();

// Create a simple tRPC context with userId
const createContext = () => {
  return {
    prisma,
    userId: 'dev-user-id',
  };
};

// Initialize tRPC
const t = initTRPC.context<typeof createContext>().create({
  transformer: superjson,
});

// Create router and procedure helpers
const router = t.router;
const publicProcedure = t.procedure;

// Create a middleware to enforce auth
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

// Create protected procedure
const protectedProcedure = publicProcedure.use(enforceUserIsAuthed);

// Create a simple project router
const projectRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      console.log(`Looking up project with ID: ${input.id}, userId: ${ctx.userId}`);
      
      // Log everything
      console.log('Input:', JSON.stringify(input));
      console.log('Context:', JSON.stringify({
        userId: ctx.userId,
        hasUser: !!ctx.userId,
      }));
      
      try {
        const project = await ctx.prisma.project.findUnique({
          where: {
            id: input.id,
          },
          include: {
            scenes: {
              include: {
                elements: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        });
        
        if (!project) {
          console.log(`Project not found: ${input.id}`);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Project with id '${input.id}' not found`,
          });
        }
        
        // Check ownership
        if (project.userId !== ctx.userId) {
          console.log(`Unauthorized: User ${ctx.userId} trying to access project ${input.id} owned by ${project.userId}`);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to access this project',
          });
        }
        
        // Sanitize data for JSON serialization
        const result = {
          id: project.id,
          name: project.name,
          description: project.description || '',
          userId: project.userId,
          format: project.format,
          duration: project.duration,
          scenes: project.scenes.map(scene => ({
            id: scene.id,
            projectId: scene.projectId,
            order: scene.order,
            duration: scene.duration,
            elements: scene.elements.map(element => ({
              id: element.id,
              type: element.type,
              content: element.content || '',
              // Add other element fields...
            })),
          })),
        };
        
        console.log('Project found:', project.id, project.name);
        console.log(`Project has ${project.scenes.length} scenes`);
        
        return result;
      } catch (error) {
        console.error('Error in getById:', error);
        throw error;
      }
    }),
});

// Create the app router
const appRouter = router({
  project: projectRouter,
});

// Test function
async function main() {
  // Create a caller
  const caller = appRouter.createCaller(createContext());
  
  try {
    // Get all projects first to have IDs to test with
    const projects = await prisma.project.findMany({
      where: { userId: 'dev-user-id' },
      select: { id: true, name: true },
      take: 5,
    });
    
    console.log('Found projects:', projects.map(p => ({ id: p.id, name: p.name })));
    
    // Test each project
    for (const project of projects) {
      console.log('\n-----------------------------------------');
      console.log(`Testing project: ${project.name} (${project.id})`);
      
      try {
        const result = await caller.project.getById({ id: project.id });
        console.log('SUCCESS: Project retrieved through tRPC');
        console.log(`Project: ${result.name}, Scenes: ${result.scenes.length}`);
      } catch (error) {
        console.error('FAILED: Error retrieving project through tRPC:', error);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main();