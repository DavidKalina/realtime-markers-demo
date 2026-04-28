import React from "react";
import { View, Pressable, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import { edColors, edFont, edRadius, edShadows } from "@/theme/editorial";

export interface EdTab {
  key: string;
  label: string;
  icon: (props: { size: number; color: string; strokeWidth: number }) => React.ReactNode;
}

interface EdTabsProps {
  tabs: EdTab[];
  active: string;
  onTabPress: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function EdTabs({ tabs, active, onTabPress, style }: EdTabsProps) {
  return (
    <View style={[styles.shadow, style]}>
      <View style={styles.clip}>
        <BlurView intensity={20} tint="light" style={styles.blur}>
          <View style={styles.row}>
            {tabs.map((tab) => {
              const isActive = tab.key === active;
              const tint = isActive ? edColors.coral : edColors.inkMute;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => onTabPress(tab.key)}
                  style={styles.tab}
                >
                  <View style={styles.iconWrap}>
                    {tab.icon({ size: 22, color: tint, strokeWidth: 1.6 })}
                  </View>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: tint,
                        fontFamily: isActive ? edFont.sansSemibold : edFont.sansMedium,
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {isActive ? <View style={styles.activePill} /> : null}
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    bottom: 16,
    left: 12,
    right: 12,
    borderRadius: edRadius.tabBar,
    backgroundColor: "rgba(255,255,255,0.85)",
    ...edShadows.tabBar,
  },
  clip: {
    borderRadius: edRadius.tabBar,
    borderWidth: 1,
    borderColor: edColors.rule,
    overflow: "hidden",
  },
  blur: { backgroundColor: "rgba(255,255,255,0.85)" },
  row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 6 },
  iconWrap: { height: 24, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, marginTop: 4, letterSpacing: -0.05 },
  activePill: {
    position: "absolute",
    bottom: 2,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: edColors.coral,
  },
});
