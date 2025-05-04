import React, { forwardRef } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { LucideIcon } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";

interface TextAreaProps extends Omit<TextInputProps, "style"> {
  icon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  error?: string;
  delay?: number;
  style?: ViewStyle;
  loading?: boolean;
  minHeight?: number;
}

const TextArea = forwardRef<TextInput, TextAreaProps>(
  (
    {
      icon: Icon,
      rightIcon: RightIcon,
      onRightIconPress,
      error,
      delay = 0,
      style,
      loading = false,
      minHeight = 100,
      ...props
    },
    ref
  ) => {
    return (
      <Animated.View
        entering={FadeInDown.duration(600).delay(delay).springify()}
        layout={LinearTransition.springify()}
        style={[styles.container, error && styles.errorContainer, { minHeight }, style]}
      >
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon size={18} color={error ? "#f97583" : "#93c5fd"} />
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
            <ActivityIndicator size="small" color="#93c5fd" />
          </View>
        ) : (
          RightIcon && (
            <TouchableOpacity
              onPress={onRightIconPress}
              style={styles.rightIconContainer}
              disabled={!onRightIconPress}
            >
              <RightIcon size={18} color={error ? "#f97583" : "#93c5fd"} />
            </TouchableOpacity>
          )
        )}
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  errorContainer: {
    borderColor: "#f97583",
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 4,
  },
  rightIconContainer: {
    padding: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    paddingTop: 0,
    paddingBottom: 0,
  },
  errorInput: {
    color: "#f97583",
  },
});

export default TextArea;
