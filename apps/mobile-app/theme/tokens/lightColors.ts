// theme/tokens/lightColors.ts - Light theme color palette (same shape as dark)
import type { Colors } from "../useColors";

export const lightColors: Colors = {
  // Background colors
  bg: {
    primary: "#ffffff",
    card: "#f5f5f7",
    cardAlt: "#eeeef0",
    elevated: "#e2e2e6",
  },

  // Text colors
  text: {
    primary: "#0a0a0a",
    secondary: "#404040",
    detail: "#3a3a3a",
    label: "#2a2a2a",
    disabled: "#8a8a8a",
    inverse: "#ffffff",
  },

  // Accent colors
  accent: {
    primary: "#059669",
    dark: "#047857",
    muted: "rgba(5, 150, 105, 0.12)",
    border: "rgba(5, 150, 105, 0.35)",
  },

  // Border / divider colors
  border: {
    default: "rgba(0, 0, 0, 0.15)",
    subtle: "rgba(0, 0, 0, 0.08)",
    medium: "rgba(0, 0, 0, 0.22)",
    accent: "rgba(0, 0, 0, 0.32)",
  },

  // Status colors
  status: {
    warning: {
      text: "#92400e",
      bg: "rgba(251, 191, 36, 0.15)",
      border: "rgba(217, 119, 6, 0.4)",
    },
    error: {
      text: "#b91c1c",
      bg: "rgba(220, 38, 38, 0.1)",
      border: "rgba(220, 38, 38, 0.35)",
    },
    success: {
      text: "#047857",
      bg: "#059669",
      border: "#059669",
    },
    info: {
      text: "#047857",
      bg: "rgba(5, 150, 105, 0.1)",
      border: "rgba(5, 150, 105, 0.35)",
    },
  },

  // Connection / location indicator colors
  connection: {
    dot: "#059669",
    dotBorder: "#ffffff",
    pulse: "rgba(5, 150, 105, 0.3)",
  },

  // Brand colors (for markers, clusters)
  brand: {
    markerStroke: "#1e293b",
    danger: "#DC2626",
  },

  // Shadow colors
  shadow: {
    default: "rgba(0, 0, 0, 0.15)",
    light: "rgba(0, 0, 0, 0.08)",
    overlay: "rgba(0, 0, 0, 0.45)",
    heavy: "rgba(0, 0, 0, 0.8)",
  },

  // Overlay colors
  overlay: {
    light: "rgba(0, 0, 0, 0.3)",
    medium: "rgba(0, 0, 0, 0.5)",
    heavy: "rgba(0, 0, 0, 0.8)",
    scrim: "rgba(0, 0, 0, 0.5)",
    white: "rgba(255, 255, 255, 0.97)",
  },

  // Action colors (vibrant per-action tints)
  action: {
    rsvp: "#047857",
    rsvpMuted: "rgba(4, 120, 87, 0.12)",
    rsvpBorder: "rgba(4, 120, 87, 0.35)",
    save: "#b45309",
    saveMuted: "rgba(180, 83, 9, 0.12)",
    saveBorder: "rgba(180, 83, 9, 0.35)",
    share: "#6d28d9",
    shareMuted: "rgba(109, 40, 217, 0.12)",
    shareBorder: "rgba(109, 40, 217, 0.35)",
    map: "#0369a1",
    mapMuted: "rgba(3, 105, 161, 0.12)",
  },

  // Fixed colors (not theme-dependent)
  fixed: {
    white: "#ffffff",
    black: "#000000",
    transparent: "transparent",
  },
};
