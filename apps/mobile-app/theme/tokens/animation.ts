// theme/tokens/animation.ts - Duration presets and spring configs

export const duration = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 800,
} as const;

export const spring = {
  gentle: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
  bouncy: {
    damping: 12,
    stiffness: 200,
    mass: 0.8,
  },
  snappy: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },
} as const;

export const animation = {
  duration,
  spring,
} as const;
