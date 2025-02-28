import { action } from "./action";
import { details } from "./details";
import { emoji } from "./emoji";
import { layout } from "./layout";
import { message } from "./message";
import { overlays } from "./overlay";
import { entity } from "./entity";

// Merge all style objects into one
export const styles = {
  ...layout,
  ...message,
  ...action,
  ...emoji,
  ...entity, // Include entity styles
  ...details,
  ...overlays,
};

// Also export individual style groups for direct access
export {
  layout,
  message,
  action,
  emoji,
  entity, // Export entity styles
  details,
  overlays,
};
