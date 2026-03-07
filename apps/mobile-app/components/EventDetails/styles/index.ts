// Barrel re-export that merges all style partials into a single `styles` object.
// This preserves backward compatibility — existing code importing { createStyles } from "./styles"
// continues to work without changes.
import type { Colors } from "@/theme";
import { createBaseStyles } from "./base";
import { createInfoCardStyles } from "./infoCard";
import { createButtonStyles } from "./buttons";
import { createQrCodeStyles } from "./qrCode";
import { createModalStyles } from "./modal";
import { createLegacyStyles } from "./legacy";

export const createStyles = (colors: Colors) =>
  ({
    ...createBaseStyles(colors),
    ...createInfoCardStyles(colors),
    ...createButtonStyles(colors),
    ...createQrCodeStyles(colors),
    ...createModalStyles(colors),
    ...createLegacyStyles(colors),
  }) as const;
