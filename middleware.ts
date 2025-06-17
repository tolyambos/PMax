import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/api/auth",
    "/api/health",
    "/api/status",
  ];
  
  // Check if current path is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Allow access to public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // For development with mock auth enabled, allow access to all routes
  if (process.env.NODE_ENV === "development" && process.env.ENABLE_MOCK_AUTH === "true") {
    return NextResponse.next();
  }
  
  // In production or when mock auth is disabled, let NextAuth handle the redirect
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ],
};