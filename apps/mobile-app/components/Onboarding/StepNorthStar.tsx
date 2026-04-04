import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { NextButton, useTypewriter, GREEN_ACCENT } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors, type Colors } from "@/theme";

// ── Generating readout with animated ASCII bars ─────────────

const BAR_W = 20;
const CHAR_MS = 40;
const READOUT_LINES = [
  { label: "Profile" },
  { label: "Location" },
  { label: "Pathways" },
  { label: "Quest 1" },
  { label: "Quest 2" },
];

function GeneratingReadout({ label }: { label: string }) {
  const [lines, setLines] = useState<number[]>(() => READOUT_LINES.map(() => 0));
  const [activeRow, setActiveRow] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let row = 0;
    let fill = 0;
    const targets = [BAR_W, BAR_W, BAR_W, BAR_W, BAR_W];

    intervalRef.current = setInterval(() => {
      fill++;
      const target = targets[row];

      setLines((prev) => {
        const next = [...prev];
        next[row] = Math.min(fill, target);
        return next;
      });
      setActiveRow(row);

      if (fill >= target) {
        row++;
        fill = 0;
        if (row >= READOUT_LINES.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    }, CHAR_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    const lower = label.toLowerCase();
    if (lower.includes("quest 1") || lower.includes("comfort zone") || lower.includes("crafting quest 1")) {
      setLines((prev) => {
        const next = [...prev];
        next[0] = BAR_W;
        next[1] = BAR_W;
        next[2] = BAR_W;
        return next;
      });
    }
  }, [label]);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={readoutStyles.container}>
      <View style={readoutStyles.header}>
        {showCursor && <Text style={readoutStyles.headerCursor}>{"\u2588"}</Text>}
        {!showCursor && <Text style={readoutStyles.headerCursor}> </Text>}
        <Text style={readoutStyles.headerText}>{label}</Text>
      </View>

      {READOUT_LINES.map((line, i) => {
        const filled = lines[i] ?? 0;
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(BAR_W - filled);
        const pct = Math.round((filled / BAR_W) * 100);
        const isActive = i === activeRow && filled < BAR_W;
        const isDone = filled >= BAR_W;

        return (
          <View key={line.label} style={readoutStyles.row}>
            <Text style={[
              readoutStyles.label,
              isDone && readoutStyles.labelDone,
              isActive && readoutStyles.labelActive,
            ]}>
              {isDone ? "\u2713" : isActive ? "\u25B8" : "\u00B7"} {line.label}
            </Text>
            <Text style={[
              readoutStyles.bar,
              isDone && readoutStyles.barDone,
              isActive && readoutStyles.barActive,
            ]}>
              {bar}
            </Text>
            <Text style={[
              readoutStyles.pct,
              isDone && readoutStyles.pctDone,
            ]}>
              {pct}%
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

const readoutStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  headerCursor: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: GREEN_ACCENT,
  },
  headerText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.2)",
    width: 80,
  },
  labelActive: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  labelDone: {
    color: "rgba(134, 239, 172, 0.5)",
  },
  bar: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: -1,
    flex: 1,
    color: "rgba(255, 255, 255, 0.12)",
  },
  barActive: {
    color: "rgba(255, 255, 255, 0.4)",
  },
  barDone: {
    color: GREEN_ACCENT,
  },
  pct: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.2)",
    width: 32,
    textAlign: "right",
  },
  pctDone: {
    color: GREEN_ACCENT,
  },
});

// ── Main step ─────────────────────────────────────────────

export function StepNorthStar({
  northStar,
  setNorthStar,
  userLocation,
  isLoading,
  generatingQuest,
  generatingLabel,
  error,
  onFinish,
  onBack,
}: {
  northStar: string;
  setNorthStar: (v: string) => void;
  userLocation: [number, number] | null;
  isLoading: boolean;
  generatingQuest: boolean;
  generatingLabel: string;
  error: string | null;
  onFinish: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();

  const prompt = useTypewriter("What does success look like?", 28, 150);
  const promptDone = prompt.length >= 28;

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (promptDone) return;
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, [promptDone]);

  return (
    <View style={s.container}>
      {onBack && !generatingQuest && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} back</Text>
        </Pressable>
      )}

      <View style={s.content}>
        {/* Typewriter prompt */}
        <View style={s.promptWrap}>
          <Text style={s.promptText}>
            {prompt}
            {!promptDone && showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
          </Text>
          {promptDone && (
            <Animated.View entering={FadeIn.delay(150).duration(350)}>
              <Text style={[s.promptSub, { color: colors.text.secondary }]}>
                Optional {"\u2014"} but it helps us understand what matters to you
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Text input */}
        {promptDone && !generatingQuest && (
          <Animated.View entering={FadeIn.delay(300).duration(400)} style={s.inputWrap}>
            <TextInput
              style={[s.input, { color: colors.text.primary }]}
              placeholder={"I'd finally feel like I belong somewhere..."}
              placeholderTextColor={"rgba(255, 255, 255, 0.2)"}
              value={northStar}
              onChangeText={setNorthStar}
              multiline
              maxLength={200}
              textAlignVertical="top"
              editable={!generatingQuest && !isLoading}
            />
          </Animated.View>
        )}

        {/* Location status */}
        {promptDone && !generatingQuest && (
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={s.statusRow}>
            <Text style={s.statusDot}>{userLocation ? "\u2713" : "\u25CB"}</Text>
            <Text style={[s.statusText, { color: colors.text.secondary }]}>
              {userLocation ? "Location acquired" : "Acquiring location..."}
            </Text>
          </Animated.View>
        )}

        {/* Generating readout */}
        {generatingQuest && (
          <GeneratingReadout label={generatingLabel} />
        )}

        {/* Error */}
        {error && (
          <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
            <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
          </View>
        )}
      </View>

      {/* Launch button */}
      <View style={s.bottom}>
        {!generatingQuest && promptDone && (
          <Animated.View entering={FadeInUp.delay(600).duration(250).springify().damping(28).stiffness(400)}>
            {error ? (
              <NextButton label="Retry" onPress={onFinish} disabled={isLoading} />
            ) : (
              <NextButton label="Launch" onPress={onFinish} disabled={isLoading} solid />
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 52,
    gap: spacing.xl,
  },
  promptWrap: {
    gap: spacing._10,
  },
  promptText: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  promptSub: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.3,
    opacity: 0.6,
  },
  cursor: {
    fontSize: 20,
    color: GREEN_ACCENT,
    opacity: 0.5,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.2)",
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  input: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 110,
    lineHeight: 24,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: GREEN_ACCENT,
    opacity: 0.6,
  },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    opacity: 0.5,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 44,
    minHeight: 80,
  },
});
