import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { HapticTab } from "@/components/HapticTab";
import { Feather } from "@expo/vector-icons";

const TabBarBackground = () => {
  return <View style={styles.tabBarBackground} />;
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#37D05C", // Bright green to match our success screen
        tabBarInactiveTintColor: "#868e96", // Medium gray for inactive
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
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "SpaceMono",
          fontSize: 12,
          marginTop: 4,
          fontWeight: "500",
          letterSpacing: 0.3,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HOME",
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Feather name="home" size={size ? size - 2 : 22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "ASSISTANT",
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Feather name="search" size={size ? size - 2 : 22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "SEARCH",
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Feather name="search" size={size ? size - 2 : 22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "SCAN",
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Feather name="camera" size={size ? size : 24} color={color} />
            </View>
          ),
          // This hides the tab bar on the scan screen
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#262626", // Fully opaque dark background
    borderTopWidth: 1,
    borderTopColor: "#333", // Subtle top border
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    width: 36,
  },
});
