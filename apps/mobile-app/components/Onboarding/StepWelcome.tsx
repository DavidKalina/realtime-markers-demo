import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTypewriter, NextButton, GREEN_ACCENT } from "./shared";
import { fontFamily, fontWeight, useColors, type Colors } from "@/theme";

const LINES = [
  { text: "> initializing...", speed: 30, pause: 400 },
  { text: "", speed: 0, pause: 200 },
  { text: "You have a goal.", speed: 28, pause: 300 },
  { text: "We\u2019ll turn it into real-world quests.", speed: 24, pause: 500 },
  { text: "", speed: 0, pause: 200 },
  { text: "Let\u2019s get started.", speed: 22, pause: 0 },
];

function useStreamedLines(lines: typeof LINES) {
  const [committed, setCommitted] = useState<string[]>([]);
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

    // Empty lines just pause then advance
    if (currentText.text === "") {
      const timer = setTimeout(() => {
        setCommitted((prev) => [...prev, ""]);
        setCurrentLine((i) => i + 1);
      }, currentText.pause);
      return () => clearTimeout(timer);
    }

    // When typing finishes, wait the pause then commit and advance
    if (typed === currentText.text) {
      const timer = setTimeout(() => {
        setCommitted((prev) => [...prev, currentText.text]);
        if (currentLine < lines.length - 1) {
          setCurrentLine((i) => i + 1);
        } else {
          setDone(true);
        }
      }, currentText.pause);
      return () => clearTimeout(timer);
    }
  }, [typed, currentText, currentLine, lines.length]);

  // Build the full line list: committed lines + the line currently being typed.
  // The current line only appears in `typed` (never duplicated) because it
  // gets removed from typed once it moves into committed on the next render.
  const allLines = [...committed];
  const isTyping = currentText && currentText.text !== "" && !done;
  if (isTyping) {
    allLines.push(typed);
  }

  return { allLines, isTyping: isTyping && typed !== currentText?.text, done };
}

export function StepWelcome({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { allLines, isTyping, done } = useStreamedLines(LINES);

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, [done]);

  return (
    <View style={s.container}>
      <View style={s.top}>
        <View style={s.terminal}>
          {allLines.map((line, i) => {
            const isLast = i === allLines.length - 1 && isTyping;
            return (
              <Text
                key={i}
                style={[
                  line.startsWith(">") ? s.cmdLine : s.bodyLine,
                  line === "" && s.emptyLine,
                ]}
              >
                {line}
                {isLast && showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
              </Text>
            );
          })}
        </View>
      </View>

      <View style={s.bottom}>
        {done ? (
          <Animated.View entering={FadeInUp.duration(300).springify().damping(28).stiffness(400)}>
            <NextButton label="Begin" onPress={onNext} solid />
          </Animated.View>
        ) : (
          <View style={s.placeholder} />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    top: {
      flex: 1,
      paddingHorizontal: 32,
      paddingTop: 80,
    },
    terminal: {
      gap: 5,
    },
    cmdLine: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: GREEN_ACCENT,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.5,
      lineHeight: 22,
      opacity: 0.6,
    },
    bodyLine: {
      fontFamily: fontFamily.mono,
      fontSize: 18,
      color: colors.text.primary,
      lineHeight: 28,
      letterSpacing: 0.2,
    },
    emptyLine: {
      height: 16,
    },
    cursor: {
      fontSize: 16,
      color: GREEN_ACCENT,
      opacity: 0.5,
    },
    bottom: {
      paddingHorizontal: 28,
      paddingBottom: 44,
      minHeight: 80,
    },
    placeholder: {
      height: 52,
    },
  });
