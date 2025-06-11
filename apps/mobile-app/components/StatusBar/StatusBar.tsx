import { useAuth } from "@/contexts/AuthContext";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import React, { useMemo, useEffect } from "react";
import {
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";
import XPBar from "./XPBar";
import { COLORS } from "../Layout/ScreenLayout";

interface StatusBarProps {
  backgroundColor?: string;
  children?: React.ReactNode;
}

const StatusBar: React.FC<StatusBarProps> = ({
  backgroundColor = "#f8fafc", // Updated to match new light background
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const jobs = useJobSessionStore((state) => state.jobs);

  // Animation values for the cog
  const rotation = useSharedValue(0);
  const cogOpacity = useSharedValue(0);
  const cogScale = useSharedValue(0.8);

  // Animation value for jobs icon
  const jobsIconScale = useSharedValue(1);

  // Check if there are any processing jobs
  const hasProcessingJobs = useMemo(() => {
    return jobs.some(
      (job) => job.status === "pending" || job.status === "processing",
    );
  }, [jobs]);

  // Check if there are any jobs
  const hasJobs = useMemo(() => {
    return jobs.length > 0;
  }, [jobs]);

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

  // Animate cog when processing jobs
  useEffect(() => {
    if (hasProcessingJobs) {
      // Show and scale up the cog
      cogOpacity.value = withTiming(1, { duration: 300 });
      cogScale.value = withTiming(1, { duration: 300 });

      // Start rotation animation
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 2000,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    } else {
      // Hide the cog
      cogOpacity.value = withTiming(0, { duration: 300 });
      cogScale.value = withTiming(0.8, { duration: 300 });

      // Stop rotation
      cancelAnimation(rotation);
      rotation.value = 0;
    }

    return () => {
      cancelAnimation(rotation);
    };
  }, [hasProcessingJobs, rotation, cogOpacity, cogScale]);

  // Animated styles for the cog
  const cogAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: cogOpacity.value,
      transform: [
        { scale: cogScale.value },
        { rotate: `${rotation.value}deg` },
      ],
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
        barStyle="dark-content" // Changed to dark-content for light theme
        backgroundColor={backgroundColor}
        translucent
      />
      <View style={styles.indicatorsRow}>
        <Animated.View
          entering={FadeIn.delay(300).springify()}
          style={styles.usernameContainer}
        >
          <Text style={styles.username}>
            {user?.displayName || user?.email}
          </Text>
          <XPBar backgroundColor={backgroundColor} />
        </Animated.View>

        {/* Animated Cog for Processing Jobs */}
        <Animated.View style={[styles.cogContainer, cogAnimatedStyle]}>
          <Ionicons name="settings" size={20} color="#f39c12" />
        </Animated.View>

        <TouchableOpacity
          onPress={handleJobsPress}
          style={styles.jobsIconContainer}
        >
          <Animated.View
            style={[
              styles.jobsIconWrapper,
              jobsIconAnimatedStyle,
              hasJobs && styles.jobsIconWrapperActive,
            ]}
          >
            <Ionicons name="briefcase" size={16} color={COLORS.textPrimary} />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <View style={styles.discoveryContainer}>
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
    borderBottomColor: "rgba(0, 0, 0, 0.05)", // Updated for light theme
  },
  indicatorsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  usernameContainer: {
    flex: 1,
    marginRight: 8,
  },
  username: {
    color: "#0f172a", // Updated to dark text for light theme
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  cogContainer: {
    marginRight: 12,
    padding: 2,
  },
  jobsIconContainer: {
    padding: 4,
  },
  jobsIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  jobsIconWrapperActive: {
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    borderColor: "rgba(0, 0, 0, 0.15)",
  },
  discoveryContainer: {
    position: "absolute",
    left: 0,
    bottom: -20, // Reduced from -40 to -20 to bring notifications closer to status bar
    zIndex: 999,
  },
});

export default React.memo(StatusBar);
