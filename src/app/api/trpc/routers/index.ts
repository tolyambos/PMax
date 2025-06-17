import { createTRPCRouter } from "@/app/api/trpc/trpc";
import { projectRouter } from "./project";
import { assetRouter } from "./asset";

export const appRouter = createTRPCRouter({
  project: projectRouter,
  asset: assetRouter,
});

export type AppRouter = typeof appRouter;
