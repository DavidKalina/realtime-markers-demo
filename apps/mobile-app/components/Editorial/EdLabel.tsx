import React from "react";
import { Text, TextStyle, StyleProp } from "react-native";
import { edColors, edFont } from "@/theme/editorial";

interface EdLabelProps {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function EdLabel({ children, color = edColors.inkMute, style }: EdLabelProps) {
  return (
    <Text
      style={[
        {
          fontFamily: edFont.monoMedium,
          fontSize: 10.5,
          letterSpacing: 1.6,
          color,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
