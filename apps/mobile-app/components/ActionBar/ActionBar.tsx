// ActionBar.tsx - With simplified animations and updated layout animations
import { styles as globalStles } from "@/components/globalStyles";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useUserLocation } from "@/hooks/useUserLocation";
import { CameraAnimateToLocationEvent, EventTypes } from "@/services/EventBroker";
import * as Haptics from "expo-haptics";
import {
  BookMarkedIcon,
  Camera,
  Info,
  Navigation,
  SearchIcon,
  Share2,
  User,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  // New imports for layout animations
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

// Create a separate component for each action button to properly handle hooks
const ActionButton: React.FC<ActionButtonProps> = React.memo(
  ({ actionKey, label, icon, onPress, isActive, disabled }) => {
    // Each button has its own scale animation

    const scaleValue = useSharedValue(1);

    // Create animated style for the button
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
      opacity: scaleValue.value === 0.9 ? 0.8 : 1,
    }));

    // Handle button press with animation
    const handlePress = React.useCallback(() => {
      // Animate button
      scaleValue.value = withSequence(
        withTiming(0.9, { duration: 100, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
        withTiming(1, { duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
      );

      // Call the parent's onPress handler
      onPress();
    }, [onPress, scaleValue]);

    return (
      <Animated.View
        style={animatedStyle}
        entering={BounceIn.duration(300).springify().damping(11).stiffness(100)}
        exiting={FadeOut.duration(200).easing(Easing.in(Easing.cubic))}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.labeledActionButton,
            isActive && styles.activeActionButton,
          ]}
          disabled={disabled}
          onPress={handlePress}
        >
          {icon}
          <Text style={styles.actionButtonLabel}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

export const ActionBar: React.FC<ActionBarProps> = React.memo(
  ({ onActionPress, isStandalone = false, animatedStyle, availableActions }) => {
    const activeActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get access to the event broker
    const { publish } = useEventBroker();

    // Dynamically determine which actions to show based on isStandalone
    const effectiveAvailableActions = ["search", "camera", "locate", "user", "saved"];
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();

    const handlePress = React.useCallback(
      (action: string) => {
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
        const timeoutId = setTimeout(() => {
          setActiveAction(null);
        }, 500);

        // Store the timeout ID in a ref
        activeActionTimeoutRef.current = timeoutId;

        // Call the callback
        onActionPress(action);
      },
      [publish, userLocation, onActionPress]
    );

    // Define all possible actions
    const allPossibleActions = React.useMemo(
      () => [
        {
          key: "search",
          label: "Search",
          icon: <SearchIcon size={20} color="#fff" style={globalStles.icon} />,
          action: () => handlePress("search"),
        },
        {
          key: "camera",
          label: "Scan",
          icon: <Camera size={20} color="#fff" style={globalStles.icon} />,
          action: () => handlePress("camera"),
        },
        {
          key: "locate",
          label: "Locate",
          icon: <Navigation size={20} color="#fff" style={globalStles.icon} />,
          action: () => handlePress("locate"),
          disabled: !userLocation, // Disable if no user location is available
        },
        {
          key: "saved",
          label: "Saved",
          icon: <BookMarkedIcon size={20} color="#fff" style={globalStles.icon} />,
          action: () => handlePress("saved"),
        },
        {
          key: "user",
          label: "Me",
          icon: <User size={20} color="#fff" style={globalStles.icon} />,
          action: () => handlePress("user"),
        },
      ],
      [userLocation]
    ); // Re-create only when userLocation changes

    React.useEffect(() => {
      return () => {
        if (activeActionTimeoutRef.current) {
          clearTimeout(activeActionTimeoutRef.current);
          activeActionTimeoutRef.current = null;
        }
      };
    }, []);

    // Filter actions based on the effectiveAvailableActions
    const scrollableActions = React.useMemo(
      () => allPossibleActions.filter((action) => effectiveAvailableActions.includes(action.key)),
      [allPossibleActions, effectiveAvailableActions]
    );

    // Apply conditional styles based on isStandalone prop
    const bottomBarStyle = React.useMemo(() => [styles.bottomBar, animatedStyle], [animatedStyle]);

    return (
      <View
        style={[
          bottomBarStyle,
          {
            paddingTop: Platform.OS === "ios" ? insets.bottom : 0,
            paddingBottom: Platform.OS === "ios" ? insets.bottom * 1.45 : 0,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={globalStles.scrollViewContainer}
          contentContainerStyle={[
            globalStles.scrollableActionsContainer,
            {
              justifyContent: "center",
              flexGrow: 1,
            },
          ]}
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
  }
);
