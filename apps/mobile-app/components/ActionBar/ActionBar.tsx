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
  HeartIcon,
  LucideIcon,
  Navigation,
  SearchIcon,
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
import { colors } from "@/theme";
import { styles } from "./styles";

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
type AppRoute = "/search" | "/scan" | "/saved" | "/user" | "/";

interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  route?: AppRoute;
  requiresLocation?: boolean;
}

const TABS: TabConfig[] = [
  { key: "search", label: "Search", icon: SearchIcon, route: "/search" },
  { key: "scan", label: "Scan", icon: Camera, route: "/scan" },
  { key: "locate", label: "Locate", icon: Navigation, requiresLocation: true },
  { key: "saved", label: "Saved", icon: HeartIcon, route: "/saved" },
  { key: "user", label: "Me", icon: User, route: "/user" },
];

const HIDDEN_ROUTES = ["/register", "/login"];

// Map pathname to active tab key
const getActiveTabKey = (pathname: string): string | null => {
  if (pathname === "/") return "locate";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/search")) return "search";
  return TABS.find((tab) => tab.route === pathname)?.key ?? null;
};

// Separate component for each button to isolate animation shared values
const ActionButton: React.FC<{
  tab: TabConfig;
  isActive: boolean;
  disabled: boolean;
  onPress: () => void;
}> = React.memo(({ tab, isActive, disabled, onPress }) => {
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
        </View>
        <Text
          style={[
            styles.actionButtonLabel,
            isActive && styles.activeActionButtonLabel,
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
  const pathname = usePathname();
  const { publish } = useEventBroker();
  const insets = useSafeAreaInsets();
  const { userLocation } = useUserLocation();
  const router = useRouter();

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
    [insets.bottom],
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
            onPress={() => handleTabPress(tab)}
          />
        ))}
      </View>
    </View>
  );
});
