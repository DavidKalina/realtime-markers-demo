// ActionBar.tsx - Refined with better icon styling and selection states
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  CameraAnimateToLocationEvent,
  EventTypes,
} from "@/services/EventBroker";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import {
  BookMarkedIcon,
  Camera,
  LucideIcon,
  Navigation,
  SearchIcon,
  User,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import {
  Easing,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./styles";

// Updated color scheme to match register/login screens
const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

interface ActionBarProps {
  isStandalone?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animatedStyle?: any;
  availableActions?: string[]; // Prop to control which actions are available
}

interface ActionButtonProps {
  actionKey: string;
  label: string;
  icon: JSX.Element;
  onPress: () => void;
  isActive: boolean;
  disabled?: boolean;
  unreadCount?: number;
}

// Pre-define animation configurations to avoid recreating them on render
const BUTTON_PRESS_ANIMATION = {
  duration: 100,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

const BUTTON_RELEASE_ANIMATION = {
  duration: 200,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// Create a separate component for each action button to properly handle hooks
const ActionButton: React.FC<ActionButtonProps> = React.memo(
  ({ label, icon, onPress, isActive, disabled }) => {
    // Each button has its own scale animation
    const scaleValue = useSharedValue(1);

    // Cleanup animation value on unmount
    useEffect(() => {
      return () => {
        scaleValue.value = 1; // Reset the animation value
      };
    }, [scaleValue]);

    // Memoize the icon color based on active state
    const iconColor = useMemo(
      () => (isActive ? newColors.text : newColors.cardBackground), // White for active, white for inactive on teal background
      [isActive],
    );

    // Handle button press with animation
    const handlePress = useCallback(() => {
      // Provide haptic feedback on button press
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // Silently handle haptic errors
        });
      }

      // Animate button - more subtle scale
      scaleValue.value = withSequence(
        withTiming(0.95, BUTTON_PRESS_ANIMATION),
        withTiming(1, BUTTON_RELEASE_ANIMATION),
      );

      // Call the parent's onPress handler
      onPress();
    }, [onPress, scaleValue]);

    // Compute button style only when active state changes
    const buttonStyle = useMemo(
      () => [styles.actionButton, disabled && { opacity: 0.5 }],
      [disabled],
    );

    // Create a wrapper for the icon to ensure consistent sizing
    const iconWithWrapper = useMemo(() => {
      // Clone the icon element to add color prop if active
      const iconElement = React.cloneElement(icon as React.ReactElement, {
        color: iconColor,
        size: 22, // Increased icon size
      });

      return <View style={styles.actionButtonIcon}>{iconElement}</View>;
    }, [icon, iconColor]);

    return (
      <TouchableOpacity
        style={buttonStyle}
        disabled={disabled}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label} button`}
        accessibilityState={{ disabled: !!disabled, selected: isActive }}
      >
        <View style={styles.actionButtonIcon}>{iconWithWrapper}</View>
      </TouchableOpacity>
    );
  },
  // Custom equality function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.actionKey === nextProps.actionKey &&
      prevProps.label === nextProps.label &&
      prevProps.unreadCount === nextProps.unreadCount
    );
  },
);

// Define the tab configuration type
interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  requiresLocation?: boolean;
  enabled: boolean;
}

// Define route type to match expo-router's expected types
type AppRoute = "/search" | "/scan" | "/saved" | "/user" | "/";

// Define all possible tabs in a single configuration object
const TAB_CONFIG: Record<string, TabConfig & { route?: AppRoute }> = {
  search: {
    key: "search",
    label: "Search",
    icon: SearchIcon,
    route: "/search",
    enabled: true,
  },
  scan: {
    key: "scan",
    label: "Scan",
    icon: Camera,
    route: "/scan",
    enabled: true,
  },
  locate: {
    key: "locate",
    label: "Locate",
    icon: Navigation,
    requiresLocation: true,
    enabled: true,
  },
  saved: {
    key: "saved",
    label: "Events",
    icon: BookMarkedIcon,
    route: "/saved",
    enabled: true,
  },
  user: {
    key: "user",
    label: "Me",
    icon: User,
    route: "/user",
    enabled: true,
  },
};

// Helper function to get enabled tabs
const getEnabledTabs = (config: Record<string, TabConfig>) => {
  return Object.values(config).filter((tab) => tab.enabled);
};

// Helper function to get the active tab key from the current path
const getActiveTabKey = (pathname: string): string | null => {
  // Handle root path
  if (pathname === "/") return "locate";

  // Handle saved routes
  if (pathname.startsWith("/saved")) return "saved";

  // Handle search routes
  if (pathname.startsWith("/search")) return "search";

  // Handle exact matches
  const exactMatch = Object.entries(TAB_CONFIG).find(
    ([, config]) => config.route === pathname,
  );
  if (exactMatch) return exactMatch[0];

  return null;
};

export const ActionBar: React.FC<ActionBarProps> = React.memo(
  ({
    animatedStyle,
    availableActions = getEnabledTabs(TAB_CONFIG).map((tab) => tab.key),
  }) => {
    const pathname = usePathname();

    const activeActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const { publish } = useEventBroker();
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const router = useRouter();

    // Get the active tab based on the current route
    const activeTab = useMemo(() => getActiveTabKey(pathname), [pathname]);

    // Memoize the camera animation event to prevent recreation
    const cameraAnimationEvent = useMemo(() => {
      if (!userLocation) return null;
      return {
        timestamp: Date.now(),
        source: "ActionBar",
        coordinates: userLocation,
        duration: 1000,
        zoomLevel: 15,
      };
    }, [userLocation]);

    // Handle action press with proper memoization - moved before its usage
    const handlePress = useCallback(
      (action: string) => {
        // Clear any existing timeout
        if (activeActionTimeoutRef.current) {
          clearTimeout(activeActionTimeoutRef.current);
          activeActionTimeoutRef.current = null;
        }

        // Trigger haptic feedback - with error handling
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
            // Silently handle haptic errors
          });
        }

        // Update UI state
        setActiveAction(action);

        const tab = TAB_CONFIG[action];
        if (!tab) return;

        // Special handling for locate action
        if (action === "locate") {
          if (pathname === "/") {
            // If we're on root, trigger the locate animation
            if (cameraAnimationEvent) {
              publish<CameraAnimateToLocationEvent>(
                EventTypes.CAMERA_ANIMATE_TO_LOCATION,
                cameraAnimationEvent,
              );
            }
          } else {
            // If we're not on root, navigate to root
            router.push("/");
          }
        } else if (tab.route) {
          // Handle navigation for other tabs if route is defined
          router.push(tab.route as AppRoute);
        }

        // Use a ref to track and clean up the timeout
        activeActionTimeoutRef.current = setTimeout(() => {
          setActiveAction(null);
          activeActionTimeoutRef.current = null;
        }, 500);
      },
      [publish, cameraAnimationEvent, router, pathname],
    );

    // Create individual action handlers with proper memoization
    const actionHandlers = useMemo(() => {
      const handlers: Record<string, () => void> = {};
      availableActions.forEach((key) => {
        handlers[key] = () => handlePress(key);
      });
      return handlers;
    }, [handlePress, availableActions]);

    // Define all possible actions using the tab config
    const allPossibleActions = useMemo(
      () =>
        Object.values(TAB_CONFIG)
          .filter((tab) => tab.enabled)
          .map((tab) => ({
            key: tab.key,
            label: tab.label,
            icon: <tab.icon size={22} color={newColors.cardBackground} />, // White icons for teal background
            action: actionHandlers[tab.key],
            disabled: tab.requiresLocation && !userLocation,
            isActive: tab.key === activeTab, // Add isActive based on current route
          })),
      [userLocation, actionHandlers, activeTab],
    );

    // Filter actions based on the availableActions prop - only recalculate when dependencies change
    const scrollableActions = useMemo(() => {
      const availableActionsSet = new Set(availableActions);
      return allPossibleActions.filter((action) =>
        availableActionsSet.has(action.key),
      );
    }, [allPossibleActions, availableActions]);

    // Calculate styles based on platform and insets - only recalculate when dependencies change
    const containerStyle = useMemo(
      () => [
        styles.bottomBar,
        animatedStyle,
        {
          paddingTop: Platform.OS === "ios" ? insets.bottom : 0,
          paddingBottom: Platform.OS === "ios" ? insets.bottom * 1.45 : 0,
        },
      ],
      [animatedStyle, insets.bottom],
    );

    // Calculate content container style - create once
    const contentContainerStyle = useMemo(
      () => [
        {
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          width: "100%",
          paddingHorizontal: 8,
        },
      ],
      [],
    );

    // Hide ActionBar on specific routes
    const hiddenRoutes = ["/register", "/login", "/onboarding"];
    if (hiddenRoutes.includes(pathname)) {
      return null;
    }

    return (
      <View style={containerStyle}>
        <View style={contentContainerStyle as StyleProp<ViewStyle>}>
          {scrollableActions.map((action) => (
            <ActionButton
              key={action.key}
              actionKey={action.key}
              label={action.label}
              icon={action.icon}
              onPress={action.action}
              isActive={action.isActive || activeAction === action.key}
              disabled={action.disabled}
            />
          ))}
        </View>
      </View>
    );
  },
  // Custom equality function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.isStandalone === nextProps.isStandalone &&
      prevProps.animatedStyle === nextProps.animatedStyle &&
      ((!prevProps.availableActions && !nextProps.availableActions) ||
        prevProps.availableActions?.join(",") ===
          nextProps.availableActions?.join(","))
    );
  },
);
