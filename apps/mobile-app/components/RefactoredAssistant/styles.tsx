// styles/index.ts
import { layout } from "./layout";
import { message } from "./message";
import { action } from "./action";
import { emoji } from "./emoji";
import { entity } from "./entity";
import { details } from "./details";

import { actionView } from "./actionViewStyles";

// Merge all style objects into one
export const styles = {
  ...layout,
  ...message,
  ...action,
  ...emoji,
  ...entity,
  ...details,
  ...actionView,
};

export { layout, message, action, emoji, entity, details, actionView };
