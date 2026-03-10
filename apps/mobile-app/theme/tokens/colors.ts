// theme/tokens/colors.ts - Single source of truth for all color values (dark theme only)

export const colors = {
  // Background colors
  bg: {
    primary: "#1a1a1a",
    card: "#2a2a2a",
    cardAlt: "#232323",
    elevated: "#333333",
  },

  // Text colors
  text: {
    primary: "#f8f9fa",
    secondary: "#a0a0a0",
    detail: "#b0b0b0",
    label: "#c0c0c0",
    disabled: "#666666",
    inverse: "#1a1a1a",
  },

  // Accent colors
  accent: {
    primary: "#86efac",
    dark: "#22c55e",
    muted: "rgba(134, 239, 172, 0.15)",
    border: "rgba(134, 239, 172, 0.3)",
  },

  // Border / divider colors
  border: {
    default: "rgba(255, 255, 255, 0.08)",
    subtle: "rgba(255, 255, 255, 0.05)",
    medium: "rgba(255, 255, 255, 0.1)",
    accent: "rgba(255, 255, 255, 0.2)",
  },

  // Status colors
  status: {
    warning: {
      text: "#d97706",
      bg: "rgba(251, 191, 36, 0.1)",
      border: "rgba(251, 191, 36, 0.3)",
    },
    error: {
      text: "#f87171",
      bg: "rgba(248, 113, 113, 0.1)",
      border: "rgba(248, 113, 113, 0.3)",
    },
    success: {
      text: "#10b981",
      bg: "#059669",
      border: "#059669",
    },
    info: {
      text: "#86efac",
      bg: "rgba(134, 239, 172, 0.15)",
      border: "rgba(134, 239, 172, 0.3)",
    },
  },

  // Connection / location indicator colors
  connection: {
    dot: "#4dabf7",
    dotBorder: "#ffffff",
    pulse: "rgba(77, 171, 247, 0.4)",
  },

  // Brand colors (for markers, clusters)
  brand: {
    markerStroke: "#E2E8F0",
    danger: "#DC2626",
  },

  // Shadow colors
  shadow: {
    default: "rgba(0, 0, 0, 0.5)",
    light: "rgba(0, 0, 0, 0.2)",
    overlay: "rgba(0, 0, 0, 0.7)",
    heavy: "rgba(0, 0, 0, 0.95)",
  },

  // Overlay colors
  overlay: {
    light: "rgba(0, 0, 0, 0.5)",
    medium: "rgba(0, 0, 0, 0.7)",
    heavy: "rgba(0, 0, 0, 0.95)",
    scrim: "rgba(0, 0, 0, 0.75)",
    white: "rgba(255, 255, 255, 0.95)",
  },

  // Action colors (vibrant per-action tints)
  action: {
    rsvp: "#34d399",
    rsvpMuted: "rgba(52, 211, 153, 0.15)",
    rsvpBorder: "rgba(52, 211, 153, 0.35)",
    save: "#fbbf24",
    saveMuted: "rgba(251, 191, 36, 0.15)",
    saveBorder: "rgba(251, 191, 36, 0.35)",
    share: "#a78bfa",
    shareMuted: "rgba(167, 139, 250, 0.15)",
    shareBorder: "rgba(167, 139, 250, 0.35)",
    map: "#38bdf8",
    mapMuted: "rgba(56, 189, 248, 0.15)",
  },

  // Fixed colors (not theme-dependent)
  fixed: {
    white: "#ffffff",
    black: "#000000",
    transparent: "transparent",
  },
} as const;
