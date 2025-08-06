import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: (req) => {
    // Check if we're using development keys in production
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
    const isDevKeysOnProd =
      process.env.NODE_ENV === "production" && publishableKey.includes("test");

    // If using dev keys on production, make everything public
    if (isDevKeysOnProd) {
      console.log(
        "[Middleware] Dev keys detected on production - making all routes public"
      );
      return true; // Make all routes public
    }

    // Otherwise, use standard public routes
    const publicPaths = [
      "/",
      "/api/webhooks",
      "/api/fonts",
      "/api/ai/analyze-image",
      "/sign-in",
      "/sign-up",
      "/auth/sign-in",
      "/auth/sign-up",
      "/fonts",
    ];

    const path = req.nextUrl.pathname;
    return publicPaths.some(
      (publicPath) => path === publicPath || path.startsWith(publicPath + "/")
    );
  },

  ignoredRoutes: [
    "/((?!api|trpc))(_next|.+\\..+)(.*)",
    "/api/fonts(.*)",
    "/fonts(.*)",
  ],

  debug: false,
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
