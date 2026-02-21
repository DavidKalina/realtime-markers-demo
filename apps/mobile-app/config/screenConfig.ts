export const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  animation: "fade_from_bottom" as const,
  animationDuration: 200,
  gestureEnabled: true,
  gestureDirection: "horizontal" as const,
  contentStyle: {
    backgroundColor: "transparent",
  },
} as const;

export const SCREEN_CONFIGS = [
  { name: "register" },
  { name: "login" },
  { name: "onboarding" },
  { name: "index" },
  { name: "scan" },
  { name: "user" },
  { name: "saved/index" },
  { name: "cluster" },
  { name: "search/index" },
  { name: "category/[id]" },
  { name: "details" },
  { name: "+not-found" },
] as const;
export const FONT_FAMILY_PATH = "../assets/fonts/SpaceMono-Regular.ttf";
