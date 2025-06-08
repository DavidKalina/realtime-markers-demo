import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import BackButton from "./BackButton";
import { COLORS } from "./ScreenLayout";

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
  titleContent?: React.ReactNode;
}

// Memoize the header styles
const headerStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  rightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  placeholderIcon: {
    width: 40,
    height: 40,
  },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
});

// Memoize the right icon component
const RightIcon = React.memo(({ icon }: { icon?: React.ReactNode }) =>
  icon ? icon : <View style={headerStyles.placeholderIcon} />,
);

const Header: React.FC<HeaderProps> = React.memo(
  ({ title, onBack, rightIcon, style, animated = true, titleContent }) => {
    const HeaderComponent = animated ? Animated.View : View;

    // Memoize the header style
    const headerStyle = useMemo(() => [headerStyles.header, style], [style]);

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
