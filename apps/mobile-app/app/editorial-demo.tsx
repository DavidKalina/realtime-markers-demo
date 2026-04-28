import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, Layers, Compass, Sparkles } from "lucide-react-native";
import {
  EdLabel,
  EdSurface,
  EdBtn,
  EdMark,
  EdEmojiHero,
  EdTabs,
  type EdTab,
} from "@/components/Editorial";
import { edColors, edFont } from "@/theme/editorial";

const TABS: EdTab[] = [
  {
    key: "me",
    label: "Me",
    icon: ({ size, color, strokeWidth }) => (
      <User size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
  {
    key: "deck",
    label: "Deck",
    icon: ({ size, color, strokeWidth }) => (
      <Layers size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
  {
    key: "explore",
    label: "Explore",
    icon: ({ size, color, strokeWidth }) => (
      <Compass size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
  {
    key: "quest",
    label: "Quest",
    icon: ({ size, color, strokeWidth }) => (
      <Sparkles size={size} color={color} strokeWidth={strokeWidth} />
    ),
  },
];

export default function EditorialDemoScreen() {
  const [activeTab, setActiveTab] = useState("deck");

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <EdLabel>Editorial Demo</EdLabel>
          <EdMark size={16} />
        </View>

        <Text style={styles.h1}>
          What feels just{" "}
          <Text style={styles.h1Italic}>a little out of reach?</Text>
        </Text>

        <Text style={styles.body}>
          Pick what's been tugging at you. We'll start one notch easier than this.
        </Text>

        <View style={styles.section}>
          <EdLabel>Surface · Resting</EdLabel>
          <EdSurface style={styles.spaceTop}>
            <Text style={styles.cardTitle}>Light Outside,</Text>
            <Text style={[styles.cardTitle, styles.italicCoral]}>No Rush</Text>
            <Text style={styles.body}>
              A slow walk along the creek. Eyes up, phone away.
            </Text>
          </EdSurface>
        </View>

        <View style={styles.section}>
          <EdLabel>Surface · Lifted + Accent</EdLabel>
          <EdSurface lifted accent={edColors.coral} style={styles.spaceTop}>
            <Text style={styles.cardTitle}>Featured card</Text>
            <Text style={styles.body}>Lifted shadow, coral accent bar.</Text>
          </EdSurface>
        </View>

        <View style={styles.section}>
          <EdLabel>EmojiHero · Sage / Coral / Sky</EdLabel>
          <View style={[styles.heroRow, styles.spaceTop]}>
            <EdEmojiHero emoji="🌿" color={edColors.sage} height={120} emojiSize={56} style={styles.heroCell} />
            <EdEmojiHero emoji="☕" color={edColors.coral} height={120} emojiSize={56} style={styles.heroCell} />
            <EdEmojiHero emoji="📚" color={edColors.sky} height={120} emojiSize={56} style={styles.heroCell} />
          </View>
        </View>

        <View style={styles.section}>
          <EdLabel>Buttons</EdLabel>
          <View style={styles.btnCol}>
            <EdBtn label="Continue" variant="primary" />
            <EdBtn label="Skip" variant="secondary" />
            <EdBtn label="Cancel" variant="ghost" />
          </View>
        </View>

        <View style={styles.section}>
          <EdLabel>Type scale</EdLabel>
          <View style={styles.spaceTop}>
            <Text style={styles.h2}>Card title (Fraunces 22/500)</Text>
            <Text style={styles.body}>Body (Inter 14/400)</Text>
            <Text style={styles.bodyEmphasis}>Body emphasis (Inter 15/600)</Text>
            <Text style={styles.tag}>tag · 11.5/500</Text>
            <Text style={styles.narrator}>
              "You've had a couple coffee-shop reps already." — narrator italic
            </Text>
          </View>
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      <EdTabs tabs={TABS} active={activeTab} onTabPress={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: edColors.paper },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  h1: {
    fontFamily: edFont.serifRegular,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: edColors.ink,
    marginTop: 22,
  },
  h1Italic: {
    fontFamily: edFont.serifMediumItalic,
    color: edColors.coral,
  },
  body: {
    fontFamily: edFont.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: edColors.inkSoft,
    marginTop: 12,
  },
  section: { marginTop: 24 },
  spaceTop: { marginTop: 10 },
  cardTitle: {
    fontFamily: edFont.serifMedium,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: edColors.ink,
  },
  italicCoral: {
    fontFamily: edFont.serifMediumItalic,
    color: edColors.coral,
  },
  heroRow: { flexDirection: "row", gap: 8 },
  heroCell: { flex: 1, height: 120 },
  btnCol: { gap: 10, marginTop: 10 },
  h2: {
    fontFamily: edFont.serifMedium,
    fontSize: 22,
    color: edColors.ink,
    letterSpacing: -0.4,
  },
  bodyEmphasis: {
    fontFamily: edFont.sansSemibold,
    fontSize: 15,
    color: edColors.ink,
    letterSpacing: -0.1,
    marginTop: 6,
  },
  tag: {
    fontFamily: edFont.sansMedium,
    fontSize: 11.5,
    color: edColors.ink,
    letterSpacing: -0.1,
    marginTop: 6,
  },
  narrator: {
    fontFamily: edFont.serifRegularItalic,
    fontSize: 14,
    lineHeight: 21,
    color: edColors.inkSoft,
    marginTop: 8,
  },
  scrollSpacer: { height: 100 },
});
