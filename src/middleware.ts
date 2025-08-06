import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

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

  afterAuth(auth, req, evt) {
    // If there's an auth error, clear cookies and redirect to sign-in
    if (!auth.userId && !auth.isPublicRoute) {
      // Clear any stale Clerk cookies by setting them to expire
      const response = NextResponse.redirect(new URL("/sign-in", req.url));

      // Get all cookies and clear Clerk-related ones
      const cookies = req.cookies.getAll();
      cookies.forEach((cookie) => {
        if (
          cookie.name.includes("__session") ||
          cookie.name.includes("__client") ||
          cookie.name.includes("clerk")
        ) {
          response.cookies.set(cookie.name, "", {
            expires: new Date(0),
            path: "/",
          });
        }
      });

      return response;
    }

    // Default behavior for authenticated users
    return NextResponse.next();
  },

  debug: false,
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
