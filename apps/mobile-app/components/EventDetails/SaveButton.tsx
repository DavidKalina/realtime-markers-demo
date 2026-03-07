import { Bookmark, BookmarkCheck } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useColors, radius, type Colors } from "@/theme";

interface SaveButtonProps {
  isSaved: boolean;
  savingState: "idle" | "loading";
  onSave: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  isSaved,
  savingState,
  onSave,
}) => {
  const colors = useColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const color = useSharedValue(0);

  // Update color when save state changes
  React.useEffect(() => {
    if (savingState === "idle") {
      color.value = withTiming(isSaved ? 1 : 0, { duration: 300 });
    }
  }, [isSaved, savingState]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleSavePress = () => {
    if (savingState === "loading") return;

    onSave();
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: interpolateColor(
        color.value,
        [0, 1],
        [colors.border.subtle, colors.accent.primary + "20"],
      ),
    };
  });

  return (
    <Pressable
      onPress={handleSavePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={savingState === "loading"}
      style={({ pressed }) => [
        styles.saveButton,
        pressed && styles.saveButtonPressed,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.buttonContent, animatedStyle]}
      >
        {savingState === "loading" ? (
          <ActivityIndicator size="small" color={colors.accent.primary} />
        ) : isSaved ? (
          <BookmarkCheck size={24} color={colors.accent.primary} />
        ) : (
          <Bookmark size={24} color={colors.accent.primary} />
        )}
      </Animated.View>
    </Pressable>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  loading: {
    opacity: 0.7,
  },
  saveButtonPressed: {
    // Add any styles for pressed state if needed
  },
});

export default React.memo(SaveButton);
