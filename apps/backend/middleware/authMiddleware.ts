import type { Context, Next } from "hono";
import type { AppContext } from "../types/context";

export const authMiddleware = async (c: Context<AppContext>, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  const authService = c.get("authService");
  const decoded = authService.validateToken(token);

  if (!decoded) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", {
    ...decoded,
    userId: decoded.id,
  });
  return next();
};
