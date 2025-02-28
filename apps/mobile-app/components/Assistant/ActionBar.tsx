import React, { useState } from "react";
import { ScrollView, TouchableOpacity, View, Text } from "react-native";
import {
  Info,
  Navigation,
  Share2,
  SearchIcon,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { styles } from "./styles";

interface ActionBarProps {
  onActionPress: (action: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ onActionPress }) => {
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
      icon: <Info size={20} color="#fcd34d" style={styles.icon} />,
      scaleValue: detailsScale,
      action: () => handlePress("details"),
    },
    {
      key: "directions",
      label: "Maps",
      icon: <Navigation size={20} color="#fcd34d" style={styles.icon} />,
      scaleValue: directionsScale,
      action: () => handlePress("directions"),
    },
    {
      key: "share",
      label: "Share",
      icon: <Share2 size={20} color="#fcd34d" style={styles.icon} />,
      scaleValue: shareScale,
      action: () => handlePress("share"),
    },
    {
      key: "search",
      label: "Search",
      icon: <SearchIcon size={20} color="#fcd34d" style={styles.icon} />,
      scaleValue: searchScale,
      action: () => handlePress("search"),
    },
    {
      key: "scan",
      label: "Scan",
      icon: <Camera size={20} color="#fcd34d" style={styles.icon} />,
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

  const previousAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: previousScale.value }],
    };
  });

  const nextAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: nextScale.value }],
    };
  });

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

  return (
    <View style={styles.bottomBar}>
      <Animated.View style={previousAnimatedStyle}>
        <TouchableOpacity
          style={[styles.actionButton, activeAction === "previous" && styles.activeActionButton]}
          onPress={() => handlePress("previous")}
        >
          <ChevronLeft size={20} color="#fcd34d" style={styles.icon} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollableActions,
          actionCount <= 3 && { flexGrow: 1, justifyContent: "space-evenly" },
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

      <Animated.View style={nextAnimatedStyle}>
        <TouchableOpacity
          style={[styles.actionButton, activeAction === "next" && styles.activeActionButton]}
          onPress={() => handlePress("next")}
        >
          <ChevronRight size={20} color="#fcd34d" style={styles.icon} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};
