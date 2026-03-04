import { colors } from "@/theme";
import { MissionIllustration } from "./illustrations/MissionIllustration";
import { MapIllustration } from "./illustrations/MapIllustration";
import { ScanIllustration } from "./illustrations/ScanIllustration";
import { DiscoverIllustration } from "./illustrations/DiscoverIllustration";
import { EngageIllustration } from "./illustrations/EngageIllustration";
import { LevelUpIllustration } from "./illustrations/LevelUpIllustration";
import { LetsGoIllustration } from "./illustrations/LetsGoIllustration";

export interface OnboardingPageData {
  id: string;
  title: string;
  body: string;
  illustration: React.ComponentType<{ active: boolean }>;
  accentColor: string;
}

export const ONBOARDING_PAGES: OnboardingPageData[] = [
  {
    id: "mission",
    title: "A Third Space",
    body: "There's a whole world of events, hidden on lamp posts, cafe walls, libraries, you name it. 'A Third Space' provides the community with a tool to bring exposure to underground events. Our goal is to make it easier for everyone to get out there and find things to do",
    illustration: MissionIllustration,
    accentColor: colors.accent.primary,
  },
  {
    id: "map",
    title: "Your City, Live",
    body: "Events appear on the map the moment they're posted. Watch your neighborhood come alive in real time.",
    illustration: MapIllustration,
    accentColor: "#38bdf8",
  },
  {
    id: "scan",
    title: "Scan It. Post It.",
    body: "Point your camera at any poster or flyer. AI reads it and pins the event to the map — instantly.",
    illustration: ScanIllustration,
    accentColor: "#a78bfa",
  },
  {
    id: "discover",
    title: "Find Your Scene",
    body: "Browse by category, date, or distance. From open mics to art shows — find what moves you.",
    illustration: DiscoverIllustration,
    accentColor: "#34d399",
  },
  {
    id: "engage",
    title: "Make It Yours",
    body: "RSVP, save, share, or pull up the map — plus every event gets an automatic AI-powered insight.",
    illustration: EngageIllustration,
    accentColor: "#34d399",
  },
  {
    id: "levelup",
    title: "Level Up",
    body: "Earn XP for every scan and event you attend. Climb the ranks and become a local legend.",
    illustration: LevelUpIllustration,
    accentColor: "#fbbf24",
  },
  {
    id: "letsgo",
    title: "You're All Set",
    body: "Your city is waiting. Start exploring.",
    illustration: LetsGoIllustration,
    accentColor: colors.accent.primary,
  },
];
