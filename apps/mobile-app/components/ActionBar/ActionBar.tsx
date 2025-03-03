// ActionBar.tsx - Updated with Reanimated 3 layout animations
import * as Haptics from "expo-haptics";
import { Camera, Info, SearchIcon, Share2 } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  Layout,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { styles } from "./styles";
import { styles as globalStles } from "@/components/globalStyles";

interface ActionBarProps {
  onActionPress: (action: string) => void;
  isStandalone?: boolean;
  animatedStyle?: any;
  availableActions?: string[]; // New prop to control which actions are available
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onActionPress,
  isStandalone = false,
  animatedStyle,
  availableActions,
}) => {
  // Dynamically determine which actions to show based on isStandalone
  const effectiveAvailableActions =
    availableActions ||
    (isStandalone ? ["search", "camera"] : ["details", "share", "search", "camera"]);

  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Create shared values for each button's scale animation
  const detailsScale = useSharedValue(1);
  const shareScale = useSharedValue(1);
  const searchScale = useSharedValue(1);
  const scanScale = useSharedValue(1);
  const previousScale = useSharedValue(1);
  const nextScale = useSharedValue(1);

  const allPossibleActions = [
    {
      key: "details",
      label: "Details",
      icon: <Info size={20} color="#fff" style={globalStles.icon} />,
      scaleValue: detailsScale,
      action: () => handlePress("details"),
    },
    {
      key: "share",
      label: "Share",
      icon: <Share2 size={20} color="#fff" style={globalStles.icon} />,
      scaleValue: shareScale,
      action: () => handlePress("share"),
    },
    {
      key: "search",
      label: "Search",
      icon: <SearchIcon size={20} color="#fff" style={globalStles.icon} />,
      scaleValue: searchScale,
      action: () => handlePress("search"),
    },
    {
      key: "camera",
      label: "Scan",
      icon: <Camera size={20} color="#fff" style={globalStles.icon} />,
      scaleValue: scanScale,
      action: () => handlePress("camera"),
    },
  ];

  // Filter actions based on the effectiveAvailableActions
  const scrollableActions = allPossibleActions.filter((action) =>
    effectiveAvailableActions.includes(action.key)
  );

  const actionCount = scrollableActions.length;

  // Pre-create animated styles for all possible actions
  const detailsAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: detailsScale.value }],
      opacity: detailsScale.value === 0.9 ? 0.8 : 1,
    };
  });

  const shareAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: shareScale.value }],
      opacity: shareScale.value === 0.9 ? 0.8 : 1,
    };
  });

  const searchAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: searchScale.value }],
      opacity: searchScale.value === 0.9 ? 0.8 : 1,
    };
  });

  const scanAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scanScale.value }],
      opacity: scanScale.value === 0.9 ? 0.8 : 1,
    };
  });

  const previousAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: previousScale.value }],
      opacity: previousScale.value === 0.9 ? 0.8 : 1,
    };
  });

  const nextAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: nextScale.value }],
      opacity: nextScale.value === 0.9 ? 0.8 : 1,
    };
  });

  // Function to get the correct animated style for a button
  const getAnimatedStyle = (key: string) => {
    switch (key) {
      case "details":
        return detailsAnimatedStyle;
      case "share":
        return shareAnimatedStyle;
      case "search":
        return searchAnimatedStyle;
      case "camera":
        return scanAnimatedStyle;
      case "previous":
        return previousAnimatedStyle;
      case "next":
        return nextAnimatedStyle;
      default:
        return detailsAnimatedStyle;
    }
  };

  // Animation sequence for button press
  const animateButton = (key: string) => {
    let scaleValue;

    switch (key) {
      case "details":
        scaleValue = detailsScale;
        break;
      case "share":
        scaleValue = shareScale;
        break;
      case "search":
        scaleValue = searchScale;
        break;
      case "camera":
        scaleValue = scanScale;
        break;
      case "previous":
        scaleValue = previousScale;
        break;
      case "next":
        scaleValue = nextScale;
        break;
      default:
        scaleValue = detailsScale;
    }

    scaleValue.value = withSequence(
      withTiming(0.9, { duration: 100, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      withTiming(1, {
        duration: 200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );
  };

  // Handle button press
  const handlePress = (action: string) => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update UI state
    setActiveAction(action);

    // Animate button
    animateButton(action);

    // Reset active action after a short delay
    setTimeout(() => {
      setActiveAction(null);
    }, 500);

    // Call the callback
    onActionPress(action);
  };

  // Apply conditional styles based on isStandalone prop
  const bottomBarStyle = [styles.bottomBar, animatedStyle];

  return (
    <View style={bottomBarStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={globalStles.scrollViewContainer}
        contentContainerStyle={[
          globalStles.scrollableActionsContainer,
          // Center the buttons when in standalone mode or when there are few buttons
          (isStandalone || actionCount <= 3) && {
            justifyContent: "center",
            flexGrow: 1,
          },
        ]}
      >
        {scrollableActions.map((action) => (
          <Animated.View
            key={action.key}
            style={getAnimatedStyle(action.key)}
            // Add layout animations
            layout={Layout.springify().damping(15).stiffness(100)}
            entering={FadeIn.duration(300).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(200).easing(Easing.in(Easing.cubic))}
          >
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.labeledActionButton,
                activeAction === action.key && styles.activeActionButton,
              ]}
              onPress={action.action}
            >
              {action.icon}
              <Text style={styles.actionButtonLabel}>{action.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
};
