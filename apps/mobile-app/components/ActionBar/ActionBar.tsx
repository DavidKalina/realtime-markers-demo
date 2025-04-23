// ActionBar.tsx - Refined with better icon styling and selection states
import { styles as globalStyles } from "@/components/globalStyles";
import { useEventBroker } from "@/hooks/useEventBroker";
import { CameraAnimateToLocationEvent, EventTypes } from "@/services/EventBroker";
import * as Haptics from "expo-haptics";
import { BookMarkedIcon, Camera, Navigation, SearchIcon, User } from "lucide-react-native";
import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  BounceIn,
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./styles";
import { useUserLocation } from "@/contexts/LocationContext";
import { useRouter } from "expo-router";

interface ActionBarProps {
  isStandalone?: boolean;
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

const ENTER_ANIMATION = BounceIn.duration(300).springify().damping(11).stiffness(100);
const EXIT_ANIMATION = FadeOut.duration(200).easing(Easing.in(Easing.cubic));

// Create a separate component for each action button to properly handle hooks
const ActionButton: React.FC<ActionButtonProps> = React.memo(
  ({ actionKey, label, icon, onPress, isActive, disabled }) => {
    // Each button has its own scale animation
    const scaleValue = useSharedValue(1);

    // Cleanup animation value on unmount
    useEffect(() => {
      return () => {
        scaleValue.value = 1; // Reset the animation value
      };
    }, [scaleValue]);

    // Create animated style for the button - this won't change between renders
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
      opacity: scaleValue.value === 0.9 ? 0.9 : 1, // Less dramatic opacity change
    }));

    // Memoize the icon color based on active state
    const iconColor = useMemo(() => (isActive ? "#93c5fd" : "#fff"), [isActive]);

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
        withTiming(0.95, BUTTON_PRESS_ANIMATION), // Less dramatic scaling
        withTiming(1, BUTTON_RELEASE_ANIMATION)
      );

      // Call the parent's onPress handler
      onPress();
    }, [onPress, scaleValue]);

    // Compute button style only when active state changes
    const buttonStyle = useMemo(
      () => [styles.actionButton, styles.labeledActionButton, disabled && { opacity: 0.5 }],
      [disabled]
    );

    // Compute label style based on active state
    const labelStyle = useMemo(
      () => [styles.actionButtonLabel, isActive && styles.activeActionButtonLabel],
      [isActive]
    );

    // Create a wrapper for the icon to ensure consistent sizing
    const iconWithWrapper = useMemo(() => {
      // Clone the icon element to add color prop if active
      const iconElement = React.cloneElement(icon as React.ReactElement, {
        color: iconColor,
        size: 20, // Consistent size
      });

      return <View style={styles.actionButtonIcon}>{iconElement}</View>;
    }, [icon, iconColor]);

    return (
      <Animated.View style={animatedStyle} entering={ENTER_ANIMATION} exiting={EXIT_ANIMATION}>
        <TouchableOpacity
          style={buttonStyle}
          disabled={disabled}
          onPress={handlePress}
          activeOpacity={0.7} // More responsive feel
          accessibilityRole="button"
          accessibilityLabel={`${label} button`}
          accessibilityState={{ disabled: !!disabled, selected: isActive }}
        >
          {iconWithWrapper}
          <Text style={labelStyle}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  },
  // Custom equality function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.actionKey === nextProps.actionKey &&
      prevProps.label === nextProps.label
    );
  }
);

// Default set of actions if none provided
const DEFAULT_AVAILABLE_ACTIONS = ["search", "scan", "locate", "user", "saved"];

// Icons memo - created once outside the component to avoid recreation
const ICON_MAP = {
  search: <SearchIcon size={20} color="#fff" />,
  scan: <Camera size={20} color="#fff" />,
  locate: <Navigation size={20} color="#fff" />,
  saved: <BookMarkedIcon size={20} color="#fff" />,
  user: <User size={20} color="#fff" />,
};

// Label map - created once outside the component
const LABEL_MAP = {
  search: "Search",
  scan: "Scan",
  locate: "Locate",
  saved: "Events",
  user: "Me",
};

export const ActionBar: React.FC<ActionBarProps> = React.memo(
  ({ isStandalone = false, animatedStyle, availableActions = DEFAULT_AVAILABLE_ACTIONS }) => {
    const activeActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { publish } = useEventBroker();
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const router = useRouter();

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

    // Handle action press with proper memoization
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

        // Special handling for locate action
        if (action === "locate" && cameraAnimationEvent) {
          // Emit event to animate camera to user location
          publish<CameraAnimateToLocationEvent>(
            EventTypes.CAMERA_ANIMATE_TO_LOCATION,
            cameraAnimationEvent
          );
        }

        // Handle navigation
        switch (action) {
          case "search":
            router.push("/search");
            break;
          case "scan":
            router.push("/scan");
            break;
          case "saved":
            router.push("/saved");
            break;
          case "user":
            router.push("/user");
            break;
          // locate is handled above with camera animation
        }

        // Use a ref to track and clean up the timeout
        activeActionTimeoutRef.current = setTimeout(() => {
          setActiveAction(null);
          activeActionTimeoutRef.current = null;
        }, 500);
      },
      [publish, cameraAnimationEvent, router]
    );

    // Create individual action handlers with proper memoization to avoid recreating functions
    const actionHandlers = useMemo(() => {
      const handlers: Record<string, () => void> = {};
      availableActions.forEach((key) => {
        handlers[key] = () => handlePress(key);
      });
      return handlers;
    }, [handlePress, availableActions]);

    // Define all possible actions - only recreate when userLocation changes
    const allPossibleActions = useMemo(
      () => [
        {
          key: "search",
          label: LABEL_MAP.search,
          icon: ICON_MAP.search,
          action: actionHandlers.search,
        },
        {
          key: "scan",
          label: LABEL_MAP.scan,
          icon: ICON_MAP.scan,
          action: actionHandlers.scan,
        },
        {
          key: "locate",
          label: LABEL_MAP.locate,
          icon: ICON_MAP.locate,
          action: actionHandlers.locate,
          disabled: !userLocation,
        },
        {
          key: "saved",
          label: LABEL_MAP.saved,
          icon: ICON_MAP.saved,
          action: actionHandlers.saved,
        },
        {
          key: "user",
          label: LABEL_MAP.user,
          icon: ICON_MAP.user,
          action: actionHandlers.user,
        },
      ],
      [userLocation, actionHandlers]
    );

    // Clean up timeouts and subscriptions when component unmounts
    useEffect(() => {
      return () => {
        // Clear any pending timeout
        if (activeActionTimeoutRef.current) {
          clearTimeout(activeActionTimeoutRef.current);
          activeActionTimeoutRef.current = null;
        }

        // Reset active action state
        setActiveAction(null);
      };
    }, []);

    // Filter actions based on the availableActions prop - only recalculate when dependencies change
    const scrollableActions = useMemo(() => {
      const availableActionsSet = new Set(availableActions);
      return allPossibleActions.filter((action) => availableActionsSet.has(action.key));
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
      [animatedStyle, insets.bottom]
    );

    // Calculate content container style - create once
    const contentContainerStyle = useMemo(
      () => [
        globalStyles.scrollableActionsContainer,
        {
          justifyContent: "center",
          flexGrow: 1,
        },
      ],
      []
    );

    return (
      <View style={containerStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={globalStyles.scrollViewContainer}
          contentContainerStyle={contentContainerStyle as any}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="menubar"
        >
          {scrollableActions.map((action) => (
            <ActionButton
              key={action.key}
              actionKey={action.key}
              label={action.label}
              icon={action.icon}
              onPress={action.action}
              isActive={activeAction === action.key}
              disabled={action.disabled}
            />
          ))}
        </ScrollView>
      </View>
    );
  },
  // Custom equality function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.isStandalone === nextProps.isStandalone &&
      prevProps.animatedStyle === nextProps.animatedStyle &&
      ((!prevProps.availableActions && !nextProps.availableActions) ||
        prevProps.availableActions?.join(",") === nextProps.availableActions?.join(","))
    );
  }
);
