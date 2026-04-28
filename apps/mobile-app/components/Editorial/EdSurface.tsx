import React from "react";
import { View, ViewStyle, StyleProp, StyleSheet } from "react-native";
import { edColors, edRadius, edShadows } from "@/theme/editorial";

interface EdSurfaceProps {
  children: React.ReactNode;
  padded?: boolean;
  accent?: string;
  lifted?: boolean;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}

export function EdSurface({
  children,
  padded = true,
  accent,
  lifted = false,
  style,
  innerStyle,
}: EdSurfaceProps) {
  return (
    <View style={[styles.shadowWrap, lifted ? edShadows.cardLifted : edShadows.cardResting, style]}>
      <View style={[styles.inner, padded && styles.padded, innerStyle]}>
        {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: edRadius.card,
    backgroundColor: edColors.paperHi,
  },
  inner: {
    borderRadius: edRadius.card,
    borderWidth: 1,
    borderColor: edColors.rule,
    backgroundColor: edColors.paperHi,
    overflow: "hidden",
  },
  padded: { padding: 18 },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
});
