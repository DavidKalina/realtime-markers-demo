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
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";
import XPBar from "./XPBar";

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

  // Check if there are any processing jobs
  const hasProcessingJobs = useMemo(() => {
    return jobs.some(
      (job) => job.status === "pending" || job.status === "processing",
    );
  }, [jobs]);

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
          onPress={() => router.push("/jobs")}
          style={styles.jobsIconContainer}
        >
          <Ionicons name="briefcase" size={24} color="#0f172a" />
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  usernameContainer: {
    flex: 1,
  },
  username: {
    color: "#0f172a", // Updated to dark text for light theme
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  cogContainer: {
    marginRight: 8,
    padding: 4,
  },
  jobsIconContainer: {
    padding: 8,
  },
  discoveryContainer: {
    position: "absolute",
    left: 0,
    bottom: -20, // Reduced from -40 to -20 to bring notifications closer to status bar
    zIndex: 999,
  },
});

export default React.memo(StatusBar);
