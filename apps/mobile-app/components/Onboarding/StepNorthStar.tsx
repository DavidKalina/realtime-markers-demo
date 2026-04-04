import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { NextButton, useTypewriter } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors, type Colors } from "@/theme";

const GREEN = "#86efac";

// ── Generating readout with animated ASCII bars ─────────────

const BAR_W = 20;
const CHAR_MS = 40;
const READOUT_LINES = [
  { label: "Profile", target: 1.0 },
  { label: "Location", target: 1.0 },
  { label: "Pathways", target: 0.0 },
  { label: "Quest 1", target: 0.0 },
  { label: "Quest 2", target: 0.0 },
];

function GeneratingReadout({ label }: { label: string }) {
  const [lines, setLines] = useState<number[]>(() => READOUT_LINES.map(() => 0));
  const [activeRow, setActiveRow] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);

  // Animate bars filling sequentially, looping through phases
  useEffect(() => {
    let row = 0;
    let fill = 0;

    // Phase targets: first 2 fill to 100%, then quest bars pulse
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
          // All done, hold
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    }, CHAR_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Update targets based on label changes (quest progress)
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
        <Animated.Text style={[readoutStyles.headerCursor, cursorBlink()]}>
          {"\u2588"}
        </Animated.Text>
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
              {line.label}
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

function cursorBlink() {
  // Simple opacity style — we'll handle the blink in the parent
  return { opacity: 1 };
}

const readoutStyles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerCursor: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: GREEN,
  },
  headerText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: GREEN,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.3)",
    width: 66,
  },
  labelActive: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  labelDone: {
    color: GREEN,
  },
  bar: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: -1,
    flex: 1,
    color: "rgba(255, 255, 255, 0.15)",
  },
  barActive: {
    color: "rgba(255, 255, 255, 0.5)",
  },
  barDone: {
    color: GREEN,
  },
  pct: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.3)",
    width: 32,
    textAlign: "right",
  },
  pctDone: {
    color: GREEN,
  },
});

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

  // Typewriter for the prompt
  const prompt = useTypewriter("What does success look like?", 30, 200);
  const promptDone = prompt.length >= 28;

  // Blinking cursor for typewriter
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (promptDone) return;
    const interval = setInterval(() => setShowCursor((v) => !v), 500);
    return () => clearInterval(interval);
  }, [promptDone]);

  return (
    <View style={s.container}>
      {onBack && !generatingQuest && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} Back</Text>
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
            <Animated.View entering={FadeIn.delay(200).duration(400)}>
              <Text style={[s.promptSub, { color: colors.text.secondary }]}>
                This is optional — but it helps us understand what matters to you
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Text input */}
        {promptDone && (
          <Animated.View entering={FadeIn.delay(400).duration(400)}>
            <TextInput
              style={[s.input, { color: colors.text.primary }]}
              placeholder={"I'd finally feel like I belong somewhere..."}
              placeholderTextColor={colors.text.disabled}
              value={northStar}
              onChangeText={setNorthStar}
              multiline
              maxLength={200}
              textAlignVertical="top"
              editable={!generatingQuest && !isLoading}
            />
          </Animated.View>
        )}

        {/* Location + status OR generating readout */}
        {promptDone && !generatingQuest && (
          <Animated.View entering={FadeIn.delay(600).duration(400)} style={s.statusSection}>
            <View style={s.statusRow}>
              <Text style={s.statusDot}>{userLocation ? "\u25CF" : "\u25CB"}</Text>
              <Text style={[s.statusText, { color: colors.text.secondary }]}>
                {userLocation ? "Location acquired" : "Acquiring location..."}
              </Text>
            </View>
          </Animated.View>
        )}

        {generatingQuest && (
          <GeneratingReadout label={generatingLabel} />
        )}

        {error && (
          <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
            <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
          </View>
        )}
      </View>

      {/* Bottom action */}
      <View style={s.bottom}>
        {!generatingQuest && promptDone && (
          <Animated.View entering={FadeIn.delay(800).duration(400)}>
            <NextButton label="Launch" onPress={onFinish} disabled={isLoading} solid />
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
    top: 12,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: spacing.xl,
  },
  promptWrap: {
    gap: spacing.sm,
  },
  promptText: {
    fontFamily: fontFamily.mono,
    fontSize: 20,
    color: GREEN,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  promptSub: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  cursor: {
    fontSize: 18,
    color: GREEN,
    opacity: 0.6,
  },
  input: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minHeight: 120,
    lineHeight: 24,
  },
  statusSection: {
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: GREEN,
  },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  generatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  generatingText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: GREEN,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
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
    paddingBottom: 40,
    minHeight: 80,
  },
});
