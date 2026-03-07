import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  useColors,
  type Colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import BackButton from "./BackButton";

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
  titleContent?: React.ReactNode;
}

// Memoize the header styles
const createHeaderStyles = (colors: Colors) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.text.primary,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },
  rightIconContainer: {
    width: spacing["4xl"],
    height: spacing["4xl"],
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  placeholderIcon: {
    width: spacing["4xl"],
    height: spacing["4xl"],
  },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  titleText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },
});

// Memoize the right icon component
const RightIcon = React.memo(({ icon }: { icon?: React.ReactNode }) => {
  const colors = useColors();
  const headerStyles = useMemo(() => createHeaderStyles(colors), [colors]);
  return icon ? icon : <View style={headerStyles.placeholderIcon} />;
});

const Header: React.FC<HeaderProps> = React.memo(
  ({ title, onBack, rightIcon, style, animated = true, titleContent }) => {
    const colors = useColors();
    const headerStyles = useMemo(() => createHeaderStyles(colors), [colors]);
    const HeaderComponent = animated ? Animated.View : View;

    // Memoize the header style
    const headerStyle = useMemo(() => [headerStyles.header, style], [headerStyles, style]);

    return (
      <HeaderComponent
        style={headerStyle}
        entering={animated ? FadeIn.duration(300) : undefined}
      >
        {onBack ? (
          <BackButton onPress={onBack} />
        ) : (
          <View style={headerStyles.placeholderIcon} />
        )}
        <View style={headerStyles.titleContainer}>
          <Text style={headerStyles.titleText} numberOfLines={1}>
            {title}
          </Text>
          {titleContent}
        </View>
        {rightIcon ? (
          <RightIcon icon={rightIcon} />
        ) : (
          <View style={headerStyles.placeholderIcon} />
        )}
      </HeaderComponent>
    );
  },
);

export default Header;
