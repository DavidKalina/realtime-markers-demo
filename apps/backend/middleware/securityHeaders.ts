import type { Context, Next } from "hono";

export const securityHeaders = () => {
  return async (c: Context, next: Next) => {
    // Security Headers
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    const isProd = (process.env.NODE_ENV || "development") === "production";
    const connectSrc = process.env.CSP_CONNECT_SRC || "'self' https:";
    const imgSrc = process.env.CSP_IMG_SRC || "'self' data: https:";
    const fontSrc = process.env.CSP_FONT_SRC || "'self' data:";
    const styleSrc = isProd
      ? "'self'"
      : "'self' 'unsafe-inline'";
    const scriptSrc = isProd
      ? "'self'"
      : "'self' 'unsafe-inline' 'unsafe-eval'";

    c.header(
      "Content-Security-Policy",
      `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src ${imgSrc}; font-src ${fontSrc}; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    );

    // HSTS (uncomment in production)
    if (isProd) {
      c.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    // CORS headers (if not using Hono's cors middleware)
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (allowedOrigins) {
      c.header("Access-Control-Allow-Origin", allowedOrigins);
    }
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", "86400");

    await next();
  };
};
