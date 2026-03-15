import type { Colors } from "@/theme";
import { MissionIllustration } from "./illustrations/MissionIllustration";
import { ScanIllustration } from "./illustrations/ScanIllustration";

export interface OnboardingPageData {
  id: string;
  title: string;
  body: string;
  illustration: React.ComponentType<{ active: boolean }>;
  accentColor: string;
}

export const createOnboardingPages = (colors: Colors): OnboardingPageData[] => [
  {
    id: "sidequests",
    title: "Your City Is a Sidequests Map",
    body: "We plan adventures around the things you love — hidden cafes, live music, street art, trails. Tell us what you're into, and we'll build itineraries that get you out there.",
    illustration: MissionIllustration,
    accentColor: colors.accent.primary,
  },
  {
    id: "scan",
    title: "Scan the Wild Stuff",
    body: "See a flyer on a lamp post? Snap it. Our AI reads it and pins the event to your map — the underground stuff Google doesn't know about.",
    illustration: ScanIllustration,
    accentColor: "#a78bfa",
  },
];
