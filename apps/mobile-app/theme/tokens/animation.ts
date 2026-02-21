// theme/tokens/animation.ts - Duration presets and spring configs

export const duration = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 800,
} as const;

export const spring = {
  // Soft, relaxed motion (back button, subtle feedback)
  soft: { damping: 10, stiffness: 200 },
  // Bouncy, playful motion (markers, pop-ins)
  bouncy: { damping: 12, stiffness: 200, mass: 0.8 },
  // Gentle interactive feedback
  gentle: { damping: 15, stiffness: 150, mass: 1 },
  // Standard press feedback (buttons, list items, toggles)
  press: { damping: 15, stiffness: 200 },
  // Quick, responsive motion (press scale, fast interactions)
  snappy: { damping: 20, stiffness: 300, mass: 1 },
  // Firm press with minimal overshoot (heavy-feel taps)
  stiff: { damping: 25, stiffness: 400 },
  // Controlled layout transitions (entering, exiting, modals)
  firm: { damping: 32, stiffness: 200 },
  // Slow, floaty motion (dropdowns, select menus, overlays)
  dropdown: { damping: 12, stiffness: 100 },
} as const;

export const animation = {
  duration,
  spring,
} as const;
