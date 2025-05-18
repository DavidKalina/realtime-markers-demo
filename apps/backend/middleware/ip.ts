import type { Context, Next } from "hono";

interface IPInfo {
  ip: string;
  isPrivate: boolean;
  isLocalhost: boolean;
  forwardedFor?: string;
  realIP?: string;
  proxyIPs?: string[];
}

export const ip = () => {
  return async (c: Context, next: Next) => {
    // Get IP from various headers and connection
    const forwardedFor = c.req.header("x-forwarded-for");
    const realIP = c.req.header("x-real-ip");
    const cfConnectingIP = c.req.header("cf-connecting-ip"); // Cloudflare
    const trueClientIP = c.req.header("true-client-ip"); // Akamai

    // Extract the client IP from forwarded-for header
    // If multiple IPs are present, the first one is the original client IP
    const proxyIPs = forwardedFor
      ? forwardedFor.split(",").map((ip) => ip.trim())
      : [];
    const clientIP =
      proxyIPs[0] ||
      realIP ||
      cfConnectingIP ||
      trueClientIP ||
      c.req.header("x-client-ip") ||
      c.req.raw.headers.get("x-client-ip") ||
      "unknown";

    // Check if IP is private
    const isPrivate = isPrivateIP(clientIP);
    const isLocalhost = clientIP === "127.0.0.1" || clientIP === "::1";

    // Create IP info object
    const ipInfo: IPInfo = {
      ip: clientIP,
      isPrivate,
      isLocalhost,
      forwardedFor,
      realIP,
      proxyIPs: proxyIPs.length > 0 ? proxyIPs : undefined,
    };

    // Set IP info in context
    c.set("ip", ipInfo);

    // Add security headers
    c.header("X-Client-IP", clientIP);
    if (proxyIPs.length > 0) {
      c.header("X-Forwarded-For", forwardedFor!);
    }

    await next();
  };
};

// Helper function to check if an IP is private
function isPrivateIP(ip: string): boolean {
  // Handle IPv6
  if (ip.includes(":")) {
    return ip.startsWith("fc00::") || ip.startsWith("fd00::");
  }

  // Handle IPv4
  const parts = ip.split(".").map(Number);

  // Check for private IP ranges
  return (
    // 10.0.0.0 - 10.255.255.255
    parts[0] === 10 ||
    // 172.16.0.0 - 172.31.255.255
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    // 192.168.0.0 - 192.168.255.255
    (parts[0] === 192 && parts[1] === 168) ||
    // 127.0.0.0 - 127.255.255.255
    parts[0] === 127
  );
}
