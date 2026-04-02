interface ScreenTransitionOptions {
  animation?: "fade_from_bottom" | "slide_from_right" | "fade" | "slide_from_left" | "none";
  animationDuration?: number;
  presentation?: "modal" | "card" | "transparentModal" | "containedModal" | "containedTransparentModal" | "fullScreenModal" | "formSheet";
}

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

interface ScreenConfig {
  name: string;
  options?: ScreenTransitionOptions;
}

export const SCREEN_CONFIGS: readonly ScreenConfig[] = [
  { name: "register" },
  { name: "login" },
  { name: "forgot-password" },
  { name: "reset-password" },
  { name: "index" },
  {
    name: "onboarding",
    options: { animation: "fade_from_bottom", animationDuration: 300 },
  },
  { name: "user" },
  {
    name: "itineraries/index",
    options: { animation: "fade", animationDuration: 150 },
  },
  {
    name: "itineraries/[id]",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  { name: "+not-found" },
] as const;
export const FONT_FAMILY_PATH = "../assets/fonts/SpaceMono-Regular.ttf";
