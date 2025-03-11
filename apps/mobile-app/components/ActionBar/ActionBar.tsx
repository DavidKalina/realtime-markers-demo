// ActionBar.tsx - Optimized for performance
import { styles as globalStyles } from "@/components/globalStyles";
import { useEventBroker } from "@/hooks/useEventBroker";
import { CameraAnimateToLocationEvent, EventTypes } from "@/services/EventBroker";
import * as Haptics from "expo-haptics";
import { BookMarkedIcon, Camera, Filter, Navigation, SearchIcon, User } from "lucide-react-native";
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

interface ActionBarProps {
  onActionPress: (action: string) => void;
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

    // Create animated style for the button - this won't change between renders
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
      opacity: scaleValue.value === 0.9 ? 0.8 : 1,
    }));

    // Handle button press with animation
    const handlePress = useCallback(() => {
      // Provide haptic feedback on button press
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Animate button
      scaleValue.value = withSequence(
        withTiming(0.9, BUTTON_PRESS_ANIMATION),
        withTiming(1, BUTTON_RELEASE_ANIMATION)
      );

      // Call the parent's onPress handler
      onPress();
    }, [onPress, scaleValue]);

    // Compute button style only when active state changes
    const buttonStyle = useMemo(
      () => [
        styles.actionButton,
        styles.labeledActionButton,
        isActive && styles.activeActionButton,
        disabled && { opacity: 0.5 },
      ],
      [isActive, disabled]
    );

    return (
      <Animated.View style={animatedStyle} entering={ENTER_ANIMATION} exiting={EXIT_ANIMATION}>
        <TouchableOpacity
          style={buttonStyle}
          disabled={disabled}
          onPress={handlePress}
          activeOpacity={0.7} // More responsive feel
        >
          {icon}
          <Text style={styles.actionButtonLabel}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  },
  // Custom equality function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.actionKey === nextProps.actionKey
      // We don't compare onPress, icon, or label as they should be stable references
    );
  }
);

// Default set of actions if none provided
const DEFAULT_AVAILABLE_ACTIONS = ["search", "camera", "locate", "user", "saved", "filter"];

export const ActionBar: React.FC<ActionBarProps> = React.memo(
  ({
    onActionPress,
    isStandalone = false,
    animatedStyle,
    availableActions = DEFAULT_AVAILABLE_ACTIONS,
  }) => {
    const activeActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { publish } = useEventBroker();
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();

    // Handle action press with proper memoization
    const handlePress = useCallback(
      (action: string) => {
        // Clear any existing timeout
        if (activeActionTimeoutRef.current) {
          clearTimeout(activeActionTimeoutRef.current);
          activeActionTimeoutRef.current = null;
        }

        // Trigger haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Update UI state
        setActiveAction(action);

        // Special handling for locate action
        if (action === "locate" && userLocation) {
          // Emit event to animate camera to user location
          publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
            timestamp: Date.now(),
            source: "ActionBar",
            coordinates: userLocation,
            duration: 1000,
            zoomLevel: 15, // Zoom in a bit more for user location
          });
        }

        // Use a ref to track and clean up the timeout
        activeActionTimeoutRef.current = setTimeout(() => {
          setActiveAction(null);
          activeActionTimeoutRef.current = null;
        }, 500);

        // Call the callback
        onActionPress(action);
      },
      [publish, userLocation, onActionPress]
    );

    // Define all possible actions - only recreate when userLocation changes
    const allPossibleActions = useMemo(
      () => [
        {
          key: "search",
          label: "Search",
          icon: <SearchIcon size={20} color="#fff" style={globalStyles.icon} />,
          action: () => handlePress("search"),
        },
        {
          key: "camera",
          label: "Scan",
          icon: <Camera size={20} color="#fff" style={globalStyles.icon} />,
          action: () => handlePress("camera"),
        },
        {
          key: "locate",
          label: "Locate",
          icon: <Navigation size={20} color="#fff" style={globalStyles.icon} />,
          action: () => handlePress("locate"),
          disabled: !userLocation, // Disable if no user location is available
        },
        {
          key: "saved",
          label: "Saved",
          icon: <BookMarkedIcon size={20} color="#fff" style={globalStyles.icon} />,
          action: () => handlePress("saved"),
        },
        {
          key: "user",
          label: "Me",
          icon: <User size={20} color="#fff" style={globalStyles.icon} />,
          action: () => handlePress("user"),
        },
        {
          key: "filter",
          label: "Filter",
          icon: <Filter size={20} color="#fff" style={globalStyles.icon} />,
          action: () => handlePress("filter"),
        },
      ],
      [userLocation, handlePress] // Re-create only when userLocation or handlePress changes
    );

    // Clean up timeouts when component unmounts
    useEffect(() => {
      return () => {
        if (activeActionTimeoutRef.current) {
          clearTimeout(activeActionTimeoutRef.current);
          activeActionTimeoutRef.current = null;
        }
      };
    }, []);

    // Filter actions based on the availableActions prop - only recalculate when dependencies change
    const scrollableActions = useMemo(
      () => allPossibleActions.filter((action) => availableActions.includes(action.key)),
      [allPossibleActions, availableActions]
    );

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
          removeClippedSubviews={true} // Optimize offscreen rendering
          keyboardShouldPersistTaps="handled" // Better keyboard handling
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
    // Only re-render if these specific props change
    return (
      prevProps.isStandalone === nextProps.isStandalone &&
      prevProps.animatedStyle === nextProps.animatedStyle &&
      // For arrays, we need to check if they're equal in content
      ((!prevProps.availableActions && !nextProps.availableActions) ||
        prevProps.availableActions?.join(",") === nextProps.availableActions?.join(","))
      // We don't compare onActionPress as it should be a stable reference
    );
  }
);
