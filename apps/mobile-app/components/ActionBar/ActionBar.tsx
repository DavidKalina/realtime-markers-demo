import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import {
  Layers,
  LucideIcon,
  LucideSword,
  Map,
  User,
} from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, fontWeight } from "@/theme";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useDeckBadgeStore } from "@/stores/useDeckBadgeStore";
import { createStyles } from "./styles";

// Pre-define animation configurations
const BUTTON_PRESS_ANIMATION = {
  duration: 100,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

const BUTTON_RELEASE_ANIMATION = {
  duration: 200,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// Define route type to match expo-router's expected types
type AppRoute = "/itineraries" | "/user" | "/deck" | "/coverage" | "/";

interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  route?: AppRoute;
  requiresLocation?: boolean;
}

const TABS: TabConfig[] = [
  {
    key: "user",
    label: "Me",
    icon: User,
    route: "/user",
  },
  {
    key: "deck",
    label: "Your Deck",
    icon: Layers,
    route: "/deck",
  },
  {
    key: "itineraries",
    label: "Quests",
    icon: LucideSword,
    route: "/itineraries",
  },
  {
    key: "coverage",
    label: "Map",
    icon: Map,
    route: "/coverage",
  },
];

const HIDDEN_ROUTES = ["/register", "/login", "/onboarding"];

// Static route → tab key mapping (no dependency on colors)
const ROUTE_TO_TAB: Record<string, string> = {
  "/user": "user",
  "/deck": "deck",
  "/coverage": "coverage",
};

// Map pathname to active tab key
const getActiveTabKey = (pathname: string): string | null => {
  if (pathname === "/" || pathname === "/user") return "user";
  if (pathname === "/deck") return "deck";
  if (pathname.startsWith("/itineraries")) return "itineraries";
  if (pathname === "/coverage") return "coverage";
  return ROUTE_TO_TAB[pathname] ?? null;
};

// Separate component for each button to isolate animation shared values
const ActionButton: React.FC<{
  tab: TabConfig;
  isActive: boolean;
  disabled: boolean;
  showBadge?: boolean;
  onPress: () => void;
}> = React.memo(({ tab, isActive, disabled, showBadge, onPress }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleValue = useSharedValue(1);
  const IconComponent = tab.icon;
  const iconColor = isActive ? colors.accent.primary : colors.text.primary;

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    scaleValue.value = withSequence(
      withTiming(0.95, BUTTON_PRESS_ANIMATION),
      withTiming(1, BUTTON_RELEASE_ANIMATION),
    );
    onPress();
  }, [onPress, scaleValue]);

  return (
    <TouchableOpacity
      style={[styles.labeledActionButton, disabled && styles.disabledButton]}
      disabled={disabled}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${tab.label} button`}
      accessibilityState={{ disabled, selected: isActive }}
    >
      <Animated.View style={[styles.actionButtonInner, animatedButtonStyle]}>
        <View style={styles.actionButtonIcon}>
          <IconComponent size={20} color={iconColor} />
          {showBadge && <View style={styles.badgeDot} />}
        </View>
        <Text
          style={[
            styles.actionButtonLabel,
            isActive && {
              color: colors.accent.primary,
              fontWeight: fontWeight.semibold,
            },
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

export const ActionBar: React.FC = React.memo(() => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hasReady: hasItineraryReady, isGenerating: isItineraryGenerating, clearReady } = useJobProgressContext();
  const hasNewDeckCards = useDeckBadgeStore((s) => s.hasNewCards);
  const clearDeckBadge = useDeckBadgeStore((s) => s.clearBadge);

  const activeTab = useMemo(() => getActiveTabKey(pathname), [pathname]);

  const handleTabPress = useCallback(
    (tab: TabConfig) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      if (tab.route) {
        if (tab.key === "itineraries" && hasItineraryReady) {
          clearReady();
        }
        if (tab.key === "deck" && hasNewDeckCards) {
          clearDeckBadge();
        }
        router.push(tab.route);
      }
    },
    [router, pathname, hasItineraryReady, clearReady],
  );

  const containerStyle = useMemo(
    () => [
      styles.bottomBar,
      {
        paddingTop: Platform.OS === "ios" ? insets.bottom : 0,
        paddingBottom: Platform.OS === "ios" ? insets.bottom * 1.45 : 0,
      },
    ],
    [insets.bottom, styles.bottomBar],
  );

  if (HIDDEN_ROUTES.includes(pathname)) {
    return null;
  }

  return (
    <View style={containerStyle}>
      <View style={styles.contentContainer}>
        {TABS.map((tab) => (
          <ActionButton
            key={tab.key}
            tab={tab}
            isActive={activeTab === tab.key}
            disabled={false}
            showBadge={
              (tab.key === "itineraries" &&
                (hasItineraryReady || isItineraryGenerating)) ||
              (tab.key === "deck" && hasNewDeckCards)
            }
            onPress={() => handleTabPress(tab)}
          />
        ))}
      </View>
    </View>
  );
});
