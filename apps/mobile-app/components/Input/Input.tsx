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

interface InputProps extends Omit<TextInputProps, "style"> {
  ref?: Ref<TextInput>;
  icon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  error?: string;
  delay?: number;
  style?: ViewStyle;
  loading?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
}

const Input = ({
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconPress,
  error,
  delay = 0,
  style,
  loading = false,
  value = "",
  onChangeText,
  ref,
  ...props
}: InputProps) => {
  const handleChangeText = (text: string) => {
    onChangeText?.(text);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(600).delay(delay).springify()}
      layout={LinearTransition.springify()}
      style={[styles.container, error && styles.errorContainer, style]}
    >
      {Icon && (
        <View style={styles.iconContainer}>
          <Icon
            size={16}
            color={error ? colors.status.error.text : colors.accent.primary}
          />
        </View>
      )}
      <TextInput
        ref={ref}
        style={[styles.input, error && styles.errorInput]}
        placeholderTextColor="#808080"
        value={value}
        onChangeText={handleChangeText}
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
              size={16}
              color={error ? colors.status.error.text : colors.accent.primary}
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
    alignItems: "center",
    backgroundColor: colors.bg.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing._10,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  errorContainer: {
    borderColor: colors.status.error.text,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  rightIconContainer: {
    padding: spacing._6,
  },
  input: {
    flex: 1,
    height: "100%",
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
  errorInput: {
    color: colors.status.error.text,
  },
});

export default Input;
