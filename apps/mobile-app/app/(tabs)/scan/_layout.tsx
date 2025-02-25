import React from "react";
import { Stack } from "expo-router";

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        freezeOnBlur: true, // Freeze components when not focused
        animationDuration: 200, // Faster transitions
      }}
    />
  );
}
