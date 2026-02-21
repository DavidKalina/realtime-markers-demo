import { useAuth } from "@/contexts/AuthContext";
import React, { useMemo } from "react";
import {
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";

const StatusBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top,
      },
    ],
    [insets.top],
  );

  const displayName = user?.firstName || user?.email || "";

  return (
    <View style={containerStyle}>
      <RNStatusBar
        barStyle="light-content"
        backgroundColor="#1a1a1a"
        translucent
      />

      <Animated.View
        entering={FadeIn.delay(200).springify()}
        layout={LinearTransition.springify()}
        style={styles.bannerContent}
      >
        {user && <Text style={styles.userName}>{displayName}</Text>}
      </Animated.View>

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
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "rgba(0, 0, 0, 0.3)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
  },
  userName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
  engagementContainer: {
    position: "absolute",
    left: 0,
    bottom: -20,
    zIndex: 999,
  },
});

export default React.memo(StatusBar);
