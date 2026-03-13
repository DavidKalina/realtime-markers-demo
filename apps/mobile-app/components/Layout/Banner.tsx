import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useColors, spacing, type Colors } from "@/theme";
import BackButton from "./BackButton";

interface BannerProps {
  onBack: () => void;
  extendToStatusBar?: boolean;
}

export default function Banner({ onBack, extendToStatusBar }: BannerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => ({
    paddingTop: extendToStatusBar ? 44 : 8,
    paddingBottom: 8,
    marginTop: extendToStatusBar ? -44 : 0,
  }));

  return (
    <Animated.View
      style={[
        styles.zoneBanner,
        zoneBannerAnimatedStyle,
        extendToStatusBar && styles.extendedBanner,
      ]}
      layout={LinearTransition.springify()}
    >
      <View style={styles.bannerContent}>
        <BackButton onPress={onBack} />
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    zoneBanner: {
      height: 90,
      backgroundColor: colors.bg.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
      justifyContent: "center",
      paddingTop: 2,
      zIndex: 2,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    extendedBanner: {
      position: "relative",
      zIndex: 2,
    },
    bannerContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
    },
  });
