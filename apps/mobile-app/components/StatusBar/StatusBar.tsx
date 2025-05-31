import { useAuth } from "@/contexts/AuthContext";
import React, { useMemo } from "react";
import { StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";
import XPBar from "./XPBar";

interface StatusBarProps {
  backgroundColor?: string;
  children?: React.ReactNode;
}

const StatusBar: React.FC<StatusBarProps> = ({
  backgroundColor = "#1a1a1a", // Match Cluster Events view background
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
        barStyle="light-content"
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
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
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
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  discoveryContainer: {
    position: "absolute",
    left: 0,
    bottom: -20, // Reduced from -40 to -20 to bring notifications closer to status bar
    zIndex: 999,
  },
});

export default React.memo(StatusBar);
