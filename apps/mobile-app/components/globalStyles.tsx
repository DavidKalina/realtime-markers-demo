// styles/index.ts
import { layout } from "./layout";
import { entity } from "./entity";

import { actionView } from "./ActionView/actionViewStyles";

// Merge all style objects into one
export const styles = {
  ...layout,
  ...entity,
  ...actionView,
};

export { layout, entity, actionView };
