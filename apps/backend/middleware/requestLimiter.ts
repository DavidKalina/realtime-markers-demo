import type { Context, Next } from "hono";

interface RequestLimiterOptions {
    maxBodySize?: number; // in bytes
    maxUrlLength?: number;
    maxHeadersSize?: number;
}

export const requestLimiter = (options: RequestLimiterOptions = {}) => {
    const {
        maxBodySize = 1024 * 1024 * 10, // 10MB
        maxUrlLength = 2048,
        maxHeadersSize = 8192,
    } = options;

    return async (c: Context, next: Next) => {
        // Check URL length
        if (c.req.url.length > maxUrlLength) {
            return c.json({ error: "URL too long" }, 414);
        }

        // Check headers size
        const headersSize = Object.entries(c.req.header())
            .reduce((acc, [key, value]) => acc + key.length + (value?.length || 0), 0);

        if (headersSize > maxHeadersSize) {
            return c.json({ error: "Headers too large" }, 431);
        }

        // Check body size for POST/PUT requests
        if (["POST", "PUT"].includes(c.req.method)) {
            const contentLength = parseInt(c.req.header("content-length") || "0", 10);
            if (contentLength > maxBodySize) {
                return c.json({ error: "Request body too large" }, 413);
            }
        }

        await next();
    };
}; 