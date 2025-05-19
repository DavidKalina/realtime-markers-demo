import type { Context, Next } from "hono";
import type { AppContext } from "../types/context";

export const adminAuthMiddleware = async (
  c: Context<AppContext>,
  next: Next,
) => {
  const user = c.get("user");

  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "Admin access required" }, 403);
  }

  await next();
};
