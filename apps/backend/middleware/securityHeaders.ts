import type { Context, Next } from "hono";

export const securityHeaders = () => {
  return async (c: Context, next: Next) => {
    // Security Headers
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;",
    );

    // HSTS (uncomment in production)
    // c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    // CORS headers (if not using Hono's cors middleware)
    c.header("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGINS || "*");
    c.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", "86400");

    await next();
  };
};
