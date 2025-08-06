import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/api/webhooks(.*)",
    "/api/fonts(.*)",
    "/api/ai/analyze-image",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/fonts(.*)",
  ],
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
