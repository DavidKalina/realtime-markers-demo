import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  CameraAnimateToLocationEvent,
  EventTypes,
} from "@/services/EventBroker";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import {
  Camera,
  CompassIcon,
  GlobeIcon,
  LucideIcon,
  Route,
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
import { useColors, fontWeight, type Colors } from "@/theme";
import { useXPStore } from "@/stores/useXPStore";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
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
type AppRoute = "/spaces" | "/scan" | "/itineraries" | "/user" | "/";

interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  route?: AppRoute;
  requiresLocation?: boolean;
  activeColor: string;
}

const getTabs = (colors: Colors): TabConfig[] => [
  {
    key: "spaces",
    label: "Spaces",
    icon: GlobeIcon,
    route: "/spaces",
    activeColor: colors.action.map,
  },
  {
    key: "scan",
    label: "Scan",
    icon: Camera,
    route: "/scan",
    activeColor: colors.action.rsvp,
  },
  {
    key: "locate",
    label: "Discover",
    icon: CompassIcon,
    requiresLocation: true,
    activeColor: colors.action.save,
  },
{
    key: "itineraries",
    label: "Plans",
    icon: Route,
    route: "/itineraries",
    activeColor: colors.accent.primary,
  },
  {
    key: "user",
    label: "Me",
    icon: User,
    route: "/user",
    activeColor: colors.action.share,
  },
];

const HIDDEN_ROUTES = ["/register", "/login", "/onboarding"];

// Static route → tab key mapping (no dependency on colors)
const ROUTE_TO_TAB: Record<string, string> = {
  "/scan": "scan",
  "/user": "user",
};

// Map pathname to active tab key
const getActiveTabKey = (pathname: string): string | null => {
  if (pathname === "/") return "locate";
  if (pathname.startsWith("/spaces")) return "spaces";
  if (pathname.startsWith("/itineraries")) return "itineraries";
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
  const iconColor = isActive ? tab.activeColor : colors.text.primary;

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
          {showBadge && (
            <View
              style={[styles.badgeDot, { backgroundColor: tab.activeColor }]}
            />
          )}
        </View>
        <Text
          style={[
            styles.actionButtonLabel,
            isActive && {
              color: tab.activeColor,
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
  const TABS = useMemo(() => getTabs(colors), [colors]);
  const pathname = usePathname();
  const { publish } = useEventBroker();
  const insets = useSafeAreaInsets();
  const { userLocation } = useUserLocation();
  const router = useRouter();
  const hasPendingXP = useXPStore((s) => s.hasPending);
  const hasItineraryReady = useItineraryJobStore((s) => s.hasReady);
  const isItineraryGenerating = useItineraryJobStore((s) => !!s.activeJobId);

  const activeTab = useMemo(() => getActiveTabKey(pathname), [pathname]);

  const handleTabPress = useCallback(
    (tab: TabConfig) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      if (tab.key === "locate") {
        if (pathname === "/") {
          if (userLocation) {
            publish<CameraAnimateToLocationEvent>(
              EventTypes.CAMERA_ANIMATE_TO_LOCATION,
              {
                timestamp: Date.now(),
                source: "ActionBar",
                coordinates: userLocation,
                duration: 1000,
                zoomLevel: 15,
              },
            );
          }
        } else {
          router.push("/");
        }
      } else if (tab.route) {
        if (tab.key === "itineraries" && hasItineraryReady) {
          useItineraryJobStore.getState().clearReady();
        }
        router.push(tab.route);
      }
    },
    [publish, userLocation, router, pathname],
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
            disabled={!!tab.requiresLocation && !userLocation}
            showBadge={
              (tab.key === "user" && hasPendingXP) ||
              (tab.key === "itineraries" && (hasItineraryReady || isItineraryGenerating))
            }
            onPress={() => handleTabPress(tab)}
          />
        ))}
      </View>
    </View>
  );
});
