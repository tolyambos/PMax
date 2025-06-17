import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Authentication middleware utility for API routes
 * Ensures only authenticated users can access protected endpoints
 */
export async function requireAuth(
  req: NextRequest
): Promise<
  { user: any; error?: never } | { user?: never; error: NextResponse }
> {
  try {
    // Check for mock auth mode
    if (process.env.ENABLE_MOCK_AUTH === "true") {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get("mock-session");

      if (sessionCookie?.value) {
        try {
          const user = JSON.parse(sessionCookie.value);
          return { user };
        } catch (parseError) {
          console.error(
            "[Auth Middleware] Error parsing mock session:",
            parseError
          );
        }
      }

      // Fallback development user when mock auth is enabled
      console.log("[Auth Middleware] Using development fallback user");
      return {
        user: {
          id: "dev-user-id",
          email: "dev@example.com",
          name: "Development User",
        },
      };
    }

    // Return unauthorized response for production or when mock auth is disabled
    return {
      error: NextResponse.json(
        {
          error: "Authentication required",
          message: "You must be signed in to access this resource.",
        },
        { status: 401 }
      ),
    };
  } catch (error) {
    console.error("[Auth Middleware] Authentication check failed:", error);

    return {
      error: NextResponse.json(
        {
          error: "Authentication failed",
          message: "Unable to verify authentication status.",
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Authentication middleware wrapper for API route handlers
 * Usage: export const POST = withAuth(async (req, { user }) => { ... });
 */
export function withAuth<T extends any[]>(
  handler: (
    req: NextRequest,
    context: { user: any },
    ...args: T
  ) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await requireAuth(req);

    if (authResult.error) {
      return authResult.error;
    }

    return handler(req, { user: authResult.user }, ...args);
  };
}

/**
 * Optional authentication middleware - allows both authenticated and unauthenticated access
 * Useful for endpoints that provide different functionality based on auth status
 */
export async function optionalAuth(
  req: NextRequest
): Promise<{ user: any | null }> {
  try {
    // Check for mock auth mode
    if (process.env.ENABLE_MOCK_AUTH === "true") {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get("mock-session");

      if (sessionCookie?.value) {
        try {
          const user = JSON.parse(sessionCookie.value);
          return { user };
        } catch (parseError) {
          console.error(
            "[Optional Auth] Error parsing mock session:",
            parseError
          );
        }
      }

      // Fallback development user when mock auth is enabled
      return {
        user: {
          id: "dev-user-id",
          email: "dev@example.com",
          name: "Development User",
        },
      };
    }

    return { user: null };
  } catch (error) {
    console.error("[Optional Auth] Authentication check failed:", error);
    return { user: null };
  }
}
