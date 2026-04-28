import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { edColors } from "@/theme/editorial";

interface EdEmojiHeroProps {
  emoji: string;
  color?: string;
  emojiSize?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function EdEmojiHero({
  emoji,
  color = edColors.coral,
  emojiSize = 64,
  height = 130,
  style,
}: EdEmojiHeroProps) {
  return (
    <View style={[{ width: "100%", height, borderRadius: 16, overflow: "hidden" }, style]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="edWash" cx="50%" cy="35%" rx="120%" ry="90%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <Stop offset="45%" stopColor={color} stopOpacity={0.06} />
            <Stop offset="100%" stopColor={edColors.paperDeep} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#edWash)" />
      </Svg>
      <View style={styles.center}>
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
