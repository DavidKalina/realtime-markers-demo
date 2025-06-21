import { useAuth } from "@/contexts/AuthContext";
import React, { useMemo } from "react";
import {
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";

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

interface MunicipalBannerProps {
  backgroundColor?: string;
  children?: React.ReactNode;
  municipalityName?: string;
  logoUrl?: string | number;
  showUserInfo?: boolean;
  showJobsButton?: boolean;
}

const MunicipalBanner: React.FC<MunicipalBannerProps> = ({
  backgroundColor = newColors.background, // Updated to use teal background
  municipalityName = "Town of Frederick",
  logoUrl = require("@/assets/images/frederick-logo.png"),
  showUserInfo = false,
  showJobsButton = true,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  // Animation value for jobs icon
  const jobsIconScale = useSharedValue(1);

  // Handle jobs icon press animation
  const handleJobsPress = () => {
    jobsIconScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );
    router.push("/jobs");
  };

  // Animated styles for the jobs icon
  const jobsIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: jobsIconScale.value }],
    };
  });

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
        barStyle="light-content" // Changed to light-content for dark teal background
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
          </View>
        </View>

        {/* Right Section - User Info and Actions */}
        <View style={styles.rightSection}>
          {showUserInfo && user && (
            <Animated.View
              entering={FadeIn.delay(400).springify()}
              style={styles.userInfoContainer}
            >
              <Text style={styles.userInfo}>
                {user?.displayName || user?.email}
              </Text>
            </Animated.View>
          )}

          {showJobsButton && (
            <TouchableOpacity
              onPress={handleJobsPress}
              style={styles.jobsIconContainer}
            >
              <Animated.View
                style={[styles.jobsIconWrapper, jobsIconAnimatedStyle]}
              >
                <Ionicons
                  name="briefcase"
                  size={16}
                  color={newColors.buttonText}
                />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>
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
    borderBottomColor: "rgba(255, 255, 255, 0.1)", // Updated for better contrast on teal
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 4,
  },
  municipalityInfo: {
    flex: 1,
  },
  municipalityName: {
    color: newColors.text, // Updated to white text for teal background
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userInfoContainer: {
    maxWidth: 120,
  },
  userInfo: {
    color: newColors.text, // Updated to white text for teal background
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SpaceMono",
    textAlign: "right",
  },
  engagementContainer: {
    position: "absolute",
    left: 0,
    bottom: -20,
    zIndex: 999,
  },
  jobsIconContainer: {
    padding: 4,
  },
  jobsIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: newColors.cardBackground, // Updated to white background
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: newColors.buttonBorder,
    shadowColor: "rgba(0, 0, 0, 0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default React.memo(MunicipalBanner);
