import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { HapticTab } from "@/components/HapticTab";
import EmojiIcon from "@/components/ui/EmojiIcon";
import { BlurView } from "expo-blur";

const TabBarBackground = () => {
  if (Platform.OS === "ios") {
    return (
      <BlurView tint="dark" intensity={100} style={StyleSheet.absoluteFill}>
        <View style={styles.overlay} />
      </BlurView>
    );
  }

  return <View style={styles.androidBackground} />;
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#CCC",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          ...Platform.select({
            ios: {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 85,
              paddingBottom: 20,
            },
            android: {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 65,
              paddingBottom: 10,
            },
          }),
          borderTopWidth: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "SpaceMono",
          fontSize: 12,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <EmojiIcon size={28} name="mappin.and.ellipse" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => (
            <EmojiIcon size={28} name="magnifyingglass.circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => <EmojiIcon size={28} name="camera.fill" color={color} />,
          // This hides the tab bar on the scan screen
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(51, 51, 51, 0.7)", // Matching popup background color with some transparency
  },
  androidBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#333", // Matching popup background color
  },
});
