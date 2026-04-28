import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { edColors, edFont } from "@/theme/editorial";

interface EdMarkProps {
  size?: number;
  color?: string;
}

export function EdMark({ size = 18, color = edColors.ink }: EdMarkProps) {
  const svgSize = size * 0.9;
  return (
    <View style={styles.row}>
      <Svg width={svgSize} height={svgSize} viewBox="0 0 20 20">
        <Circle cx="10" cy="10" r="3.2" fill={edColors.coral} />
        <Circle
          cx="10"
          cy="10"
          r="8.5"
          fill="none"
          stroke={edColors.coral}
          strokeWidth="1.4"
          strokeDasharray="1.4 2.4"
        />
      </Svg>
      <Text style={[styles.text, { fontSize: size, color }]}>Sidequests</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: {
    fontFamily: edFont.serifMedium,
    letterSpacing: -0.3,
  },
});
