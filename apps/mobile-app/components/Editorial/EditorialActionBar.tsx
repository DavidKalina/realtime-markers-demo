import React from "react";
import { usePathname, useRouter } from "expo-router";
import { User, Spade, Sword } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { EdTabs, type EdTab } from "./EdTabs";

const SHOWN_ROUTES = ["/itineraries", "/user", "/deck"];

const TABS: EdTab[] = [
  {
    key: "user",
    label: "Me",
    icon: ({ size, color, strokeWidth }) => (
      <User size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
  {
    key: "deck",
    label: "Deck",
    icon: ({ size, color, strokeWidth }) => (
      <Spade size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
  {
    key: "itineraries",
    label: "Quests",
    icon: ({ size, color, strokeWidth }) => (
      <Sword size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
];

const ROUTE_BY_KEY: Record<string, string> = {
  user: "/user",
  deck: "/deck",
  itineraries: "/itineraries",
};

const getActiveKey = (pathname: string): string => {
  if (pathname === "/" || pathname === "/user") return "user";
  if (pathname === "/deck") return "deck";
  if (pathname.startsWith("/itineraries")) return "itineraries";
  return "";
};

const isShown = (pathname: string): boolean => {
  // Tab bar lives on top-level routes only — detail/sub-routes get their
  // own sticky footers and shouldn't double up.
  const norm = pathname === "/" ? "/user" : pathname;
  return SHOWN_ROUTES.includes(norm);
};

export function EditorialActionBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (!isShown(pathname)) return null;

  const active = getActiveKey(pathname);

  const onTabPress = (key: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const route = ROUTE_BY_KEY[key];
    if (route && route !== pathname) {
      router.push(route as never);
    }
  };

  return <EdTabs tabs={TABS} active={active} onTabPress={onTabPress} />;
}
