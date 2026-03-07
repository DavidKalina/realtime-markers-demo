import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useColors, spacing, radius, fontFamily, type Colors } from "@/theme";
import BackButton from "./BackButton";

interface BannerProps {
  name: string;
  onBack: () => void;
  scrollY: SharedValue<number>;
  extendToStatusBar?: boolean;
  logoUrl?: string | number;
}

export default function Banner({
  name,
  onBack,
  extendToStatusBar,
}: BannerProps) {
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
        <View style={styles.leftSection}>
          <BackButton onPress={onBack} />
        </View>

        <View style={styles.centerSection}>
          <Text style={styles.zoneBannerName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
        </View>

        <View style={styles.rightSection}>
          {/* Invisible element to balance the layout and center the text */}
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  zoneBanner: {
    height: 90,
    backgroundColor: colors.bg.card,
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
  leftSection: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  rightSection: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: radius.sm / 2,
  },
  zoneBannerName: {
    color: colors.text.primary,
    fontSize: 22,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.4,
    lineHeight: 26,
    height: 26,
    textAlignVertical: "center",
  },
});
