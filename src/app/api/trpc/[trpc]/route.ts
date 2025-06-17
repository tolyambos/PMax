import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/app/api/trpc/routers";
import { createTRPCContext } from "@/app/api/trpc/trpc";
import { NextRequest } from "next/server";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`❌ tRPC Error on ${path}: ${error.message}`);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
