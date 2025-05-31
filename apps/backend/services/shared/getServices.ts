import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import type { GroupService } from "../GroupService";

export function getServices(c: Context<AppContext>) {
  const groupService = c.get("groupService") as GroupService;

  return {
    groupService,
  };
}
