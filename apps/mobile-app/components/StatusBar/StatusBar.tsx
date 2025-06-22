import { useAuth } from "@/contexts/AuthContext";
import React, { useMemo } from "react";
import {
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";

// Updated color scheme to match register/login screens
const municipalColors = {
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
  primary: "#00697A",
  textSecondary: "#6c757d",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
  border: "#E0E0E0",
  shadow: "rgba(0, 0, 0, 0.1)",
};

interface MunicipalBannerProps {
  backgroundColor?: string;
  children?: React.ReactNode;
  municipalityName?: string;
  logoUrl?: string | number;
  showUserInfo?: boolean;
  tagline?: string;
}

const MunicipalBanner: React.FC<MunicipalBannerProps> = ({
  backgroundColor = municipalColors.background,
  municipalityName = "Town of Frederick",
  logoUrl = require("@/assets/images/frederick-logo.png"),
  showUserInfo = false,
  tagline = "Built on what Matters",
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        backgroundColor,
        paddingTop: insets.top,
      },
    ],
    [backgroundColor, insets.top],
  );

  return (
    <View style={containerStyle}>
      <RNStatusBar
        barStyle="dark-content"
        backgroundColor={backgroundColor}
        translucent
      />

      {/* Municipal Banner Content */}
      <Animated.View
        entering={FadeIn.delay(200).springify()}
        layout={LinearTransition.springify()}
        style={styles.bannerContent}
      >
        {/* Left Section - Logo and Municipality Info */}
        <View style={styles.leftSection}>
          {logoUrl && (
            <Image
              source={typeof logoUrl === "string" ? { uri: logoUrl } : logoUrl}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
          <View style={styles.municipalityInfo}>
            <Text style={styles.municipalityName}>{municipalityName}</Text>
            <Text style={styles.tagline}>{tagline}</Text>
          </View>
        </View>

        {/* Right Section - User Info */}
        {showUserInfo && user && (
          <Animated.View
            entering={FadeIn.delay(400).springify()}
            style={styles.userInfoContainer}
          >
            <Text style={styles.userInfo}>
              {(() => {
                if (user?.firstName && user?.lastName) {
                  return `${user.firstName} ${user.lastName}`;
                } else if (user?.firstName) {
                  return user.firstName;
                } else if (user?.lastName) {
                  return user.lastName;
                }
                return user?.email || "";
              })()}
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Civic Engagement Indicator */}
      <View style={styles.engagementContainer}>
        <DiscoveryIndicator position="bottom-left" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: municipalColors.border,
    shadowColor: municipalColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 64,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 16,
    borderRadius: 6,
  },
  municipalityInfo: {
    flex: 1,
  },
  municipalityName: {
    color: municipalColors.text,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Poppins-Bold",
    letterSpacing: 0.2,
    lineHeight: 22,
    marginBottom: 2,
  },
  tagline: {
    color: municipalColors.text,
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Poppins-Medium",
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  userInfoContainer: {
    maxWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: municipalColors.primary,
    borderRadius: 20,
  },
  userInfo: {
    color: municipalColors.background,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  engagementContainer: {
    position: "absolute",
    left: 0,
    bottom: -20,
    zIndex: 999,
  },
});

export default React.memo(MunicipalBanner);
