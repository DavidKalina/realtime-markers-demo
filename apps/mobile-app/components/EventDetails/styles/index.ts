// Barrel re-export that merges all style partials into a single `styles` object.
// This preserves backward compatibility — existing code importing { styles } from "./styles"
// continues to work without changes.
import { baseStyles } from "./base";
import { infoCardStyles } from "./infoCard";
import { buttonStyles } from "./buttons";
import { qrCodeStyles } from "./qrCode";
import { modalStyles } from "./modal";
import { legacyStyles } from "./legacy";

export const styles = {
  ...baseStyles,
  ...infoCardStyles,
  ...buttonStyles,
  ...qrCodeStyles,
  ...modalStyles,
  ...legacyStyles,
} as const;
