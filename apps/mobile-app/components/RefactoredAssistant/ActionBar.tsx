// ActionBar.tsx - Updated with conditional rounded corners and centered buttons
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
} from "react-native-reanimated";
import { styles } from "./styles"; // Using the newly organized styles

interface ActionBarProps {
  onActionPress: (action: string) => void;
  isStandalone?: boolean; // Boolean prop to determine if ActionBar is standalone (no marker selected)
  animatedStyle?: any; // Add animated style prop for dynamic styling
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onActionPress,
  isStandalone = false,
  animatedStyle,
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Create shared values for each button's scale animation
  const detailsScale = useSharedValue(1);
  const directionsScale = useSharedValue(1);
  const shareScale = useSharedValue(1);
  const searchScale = useSharedValue(1);
  const scanScale = useSharedValue(1);
  const previousScale = useSharedValue(1);
  const nextScale = useSharedValue(1);

  const scrollableActions = [
    {
      key: "details",
      label: "Details",
      // Updated icon color to match the modern style
      icon: <Info size={20} color="#4dabf7" style={styles.icon} />,
      scaleValue: detailsScale,
      action: () => handlePress("details"),
    },

    {
      key: "share",
      label: "Share",
      icon: <Share2 size={20} color="#4dabf7" style={styles.icon} />,
      scaleValue: shareScale,
      action: () => handlePress("share"),
    },
    {
      key: "search",
      label: "Search",
      icon: <SearchIcon size={20} color="#4dabf7" style={styles.icon} />,
      scaleValue: searchScale,
      action: () => handlePress("search"),
    },
    {
      key: "camera", // Change from "scan" to "camera"
      label: "Scan", // Keep the user-facing label as "Scan"
      icon: <Camera size={20} color="#4dabf7" style={styles.icon} />,
      scaleValue: scanScale,
      action: () => handlePress("camera"),
    },
  ];

  const actionCount = scrollableActions.length;

  // Create animated styles for each button
  const getAnimatedStyle = (scaleValue: any) => {
    return useAnimatedStyle(() => {
      return {
        transform: [{ scale: scaleValue.value }],
        opacity: scaleValue.value === 0.9 ? 0.8 : 1,
      };
    });
  };

  // Function to get the correct shared value for a button
  const getScaleValue = (key: string) => {
    switch (key) {
      case "details":
        return detailsScale;
      case "directions":
        return directionsScale;
      case "share":
        return shareScale;
      case "search":
        return searchScale;
      case "camera":
      case "scan":
        return scanScale;
      case "previous":
        return previousScale;
      case "next":
        return nextScale;
      default:
        return detailsScale;
    }
  };

  // Animation sequence for button press
  const animateButton = (key: string) => {
    const scaleValue = getScaleValue(key);

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
    animateButton(action === "camera" ? "scan" : action);

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
        style={styles.scrollViewContainer}
        contentContainerStyle={[
          styles.scrollableActionsContainer,
          // Center the buttons when in standalone mode or when there are few buttons
          (isStandalone || actionCount <= 3) && {
            justifyContent: "center",
            flexGrow: 1,
          },
        ]}
      >
        {scrollableActions.map((action) => (
          <Animated.View key={action.key} style={getAnimatedStyle(action.scaleValue)}>
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
