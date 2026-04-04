import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTypewriter, NextButton } from "./shared";
import { fontFamily, fontWeight, spacing, useColors, type Colors } from "@/theme";

const GREEN = "#86efac";

const LINES = [
  { text: "> initializing...", speed: 35, pause: 400 },
  { text: "You have a goal.", speed: 30, pause: 300 },
  { text: "We break it into real-world quests —", speed: 30, pause: 200 },
  { text: "one step at a time.", speed: 30, pause: 500 },
  { text: "", speed: 0, pause: 300 },
  { text: "Real places. Real progress.", speed: 25, pause: 200 },
  { text: "Let's map your path.", speed: 25, pause: 0 },
];

function useStreamedLines(lines: typeof LINES) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [done, setDone] = useState(false);

  const currentText = lines[currentLine];
  const typed = useTypewriter(
    currentText?.text ?? "",
    currentText?.speed ?? 30,
    currentLine === 0 ? 600 : 0,
  );

  useEffect(() => {
    if (!currentText) return;
    if (currentText.text === "") {
      // Empty line — just pause then advance
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, ""]);
        setCurrentLine((i) => i + 1);
      }, currentText.pause);
      return () => clearTimeout(timer);
    }
    if (typed === currentText.text) {
      // Line finished typing
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, currentText.text]);
        if (currentLine < lines.length - 1) {
          setCurrentLine((i) => i + 1);
        } else {
          setDone(true);
        }
      }, currentText.pause);
      return () => clearTimeout(timer);
    }
  }, [typed, currentText, currentLine, lines.length]);

  return { visibleLines, currentTyping: currentText?.text === "" ? null : typed, done };
}

export function StepWelcome({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { visibleLines, currentTyping, done } = useStreamedLines(LINES);

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={s.container}>
      <View style={s.center}>
        <View style={s.terminal}>
          {visibleLines.map((line, i) => (
            <Text
              key={i}
              style={[
                i === 0 ? s.initLine : s.bodyLine,
                line === "" && s.emptyLine,
              ]}
            >
              {line}
            </Text>
          ))}
          {currentTyping != null && (
            <Text style={visibleLines.length === 0 ? s.initLine : s.bodyLine}>
              {currentTyping}
              {showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
            </Text>
          )}
        </View>
      </View>

      <View style={s.bottom}>
        {done ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <NextButton label="Begin" onPress={onNext} />
          </Animated.View>
        ) : (
          <NextButton label="Begin" onPress={onNext} disabled />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    terminal: {
      gap: 6,
    },
    initLine: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      color: GREEN,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    bodyLine: {
      fontFamily: fontFamily.mono,
      fontSize: 15,
      color: colors.text.secondary,
      lineHeight: 24,
    },
    emptyLine: {
      height: 12,
    },
    cursor: {
      fontSize: 14,
      color: GREEN,
      opacity: 0.6,
    },
    bottom: {
      paddingHorizontal: 28,
      paddingBottom: 40,
    },
  });
