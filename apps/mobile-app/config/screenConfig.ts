import { NativeStackNavigationOptions } from "@react-navigation/native-stack";

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
  options?: Pick<
    NativeStackNavigationOptions,
    | "animation"
    | "animationDuration"
    | "presentation"
  >;
}

export const SCREEN_CONFIGS: readonly ScreenConfig[] = [
  { name: "register" },
  { name: "login" },
  { name: "forgot-password" },
  { name: "reset-password" },
  { name: "onboarding" },
  { name: "index" },
  { name: "scan" },
  { name: "user" },
  {
    name: "saved/index",
    options: { animation: "fade", animationDuration: 150 },
  },
  {
    name: "cluster",
    options: { animation: "fade_from_bottom", animationDuration: 250 },
  },
  {
    name: "search/index",
    options: { presentation: "modal" },
  },
  {
    name: "category/[id]",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  {
    name: "spaces/index",
    options: { animation: "fade", animationDuration: 150 },
  },
  {
    name: "spaces/[city]",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  {
    name: "details",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  {
    name: "area-scan",
    options: { animation: "fade_from_bottom", animationDuration: 250 },
  },
  {
    name: "batch-upload",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  {
    name: "itineraries/index",
    options: { animation: "fade", animationDuration: 150 },
  },
  {
    name: "itineraries/[id]",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  {
    name: "trail",
    options: { animation: "slide_from_right", animationDuration: 250 },
  },
  { name: "+not-found" },
] as const;
export const FONT_FAMILY_PATH = "../assets/fonts/SpaceMono-Regular.ttf";
