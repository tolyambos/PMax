import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/app/api/trpc/trpc";

export const assetRouter = createTRPCRouter({
  upload: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.string(),
        url: z.string(),
        thumbnail: z.string().optional(),
        duration: z.number().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const asset = await ctx.prisma.asset.create({
        data: {
          name: input.name,
          type: input.type,
          url: input.url,
          thumbnail: input.thumbnail,
          duration: input.duration,
          tags: input.tags || [],
          userId,
        },
      });

      return asset;
    }),

  getAll: protectedProcedure
    .input(
      z
        .object({
          type: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const assets = await ctx.prisma.asset.findMany({
        where: {
          userId: ctx.userId,
          ...(input?.type ? { type: input.type } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return assets;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.asset.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),
});
