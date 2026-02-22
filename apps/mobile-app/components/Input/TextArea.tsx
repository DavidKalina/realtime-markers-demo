import React, { Ref } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import { LucideIcon } from "lucide-react-native";
import { colors, spacing, radius, fontSize, fontFamily } from "@/theme";

interface TextAreaProps extends Omit<TextInputProps, "style"> {
  ref?: Ref<TextInput>;
  icon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  error?: string;
  delay?: number;
  style?: ViewStyle;
  loading?: boolean;
  minHeight?: number;
}

const TextArea = ({
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconPress,
  error,
  delay = 0,
  style,
  loading = false,
  minHeight = 100,
  ref,
  ...props
}: TextAreaProps) => {
  return (
    <Animated.View
      entering={FadeInDown.duration(600).delay(delay).springify()}
      layout={LinearTransition.springify()}
      style={[
        styles.container,
        error && styles.errorContainer,
        { minHeight },
        style,
      ]}
    >
      {Icon && (
        <View style={styles.iconContainer}>
          <Icon size={18} color={error ? "#f97583" : colors.accent.primary} />
        </View>
      )}
      <TextInput
        ref={ref}
        style={[styles.input, error && styles.errorInput]}
        placeholderTextColor="#808080"
        multiline
        textAlignVertical="top"
        {...props}
      />
      {loading ? (
        <View style={styles.rightIconContainer}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
        </View>
      ) : (
        RightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconContainer}
            disabled={!onRightIconPress}
          >
            <RightIcon
              size={18}
              color={error ? "#f97583" : colors.accent.primary}
            />
          </TouchableOpacity>
        )
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  errorContainer: {
    borderColor: "#f97583",
  },
  iconContainer: {
    marginRight: spacing._10,
    marginTop: 4,
  },
  rightIconContainer: {
    padding: spacing.sm,
    alignSelf: "flex-start",
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    minHeight: 24,
  },
  errorInput: {
    color: "#f97583",
  },
});

export default TextArea;
