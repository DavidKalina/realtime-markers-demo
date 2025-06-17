import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if user is authenticated by looking for auth tokens
  const hasAuthToken =
    request.cookies.has("auth_access_token") ||
    request.cookies.has("auth_refresh_token");

  // Public routes that don't require authentication
  const publicRoutes = ["/login"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // If user is not authenticated and trying to access a protected route
  if (!hasAuthToken && !isPublicRoute && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If user is authenticated and trying to access login page
  if (hasAuthToken && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
