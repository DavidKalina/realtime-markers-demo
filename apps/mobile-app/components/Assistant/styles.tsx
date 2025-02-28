// styles/index.ts
import { layout } from "./layout";
import { message } from "./message";
import { action } from "./action";
import { emoji } from "./emoji";
import { entity } from "./entity";
import { details } from "./details";
import { overlays } from "./overlay";
import { search } from "./search"; // Import search styles

// Merge all style objects into one
export const styles = {
  ...layout,
  ...message,
  ...action,
  ...emoji,
  ...entity,
  ...details,
  ...overlays,
  ...search, // Include search styles
};

// Also export individual style groups for direct access
export {
  layout,
  message,
  action,
  emoji,
  entity,
  details,
  overlays,
  search, // Export search styles
};
