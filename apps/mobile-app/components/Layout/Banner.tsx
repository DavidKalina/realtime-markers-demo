import React from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import Animated, {
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import BackButton from "./BackButton";

// Updated color scheme to match register/login screens
const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

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
  logoUrl = require("@/assets/images/frederick-logo.png"),
}: BannerProps) {
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
          <Text style={styles.zoneBannerName}>{name}</Text>
        </View>

        <View style={styles.rightSection}>
          {logoUrl && (
            <Image
              source={typeof logoUrl === "string" ? { uri: logoUrl } : logoUrl}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zoneBanner: {
    height: 90,
    backgroundColor: newColors.background,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
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
    paddingHorizontal: 16,
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
    borderRadius: 4,
  },
  zoneBannerName: {
    color: newColors.text,
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 26,
    height: 26,
    textAlignVertical: "center",
  },
});
