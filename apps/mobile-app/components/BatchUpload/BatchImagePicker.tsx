import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  useColors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  type Colors,
} from "@/theme";

interface BatchImagePickerProps {
  currentCount: number;
  maxCount: number;
  onImagesPicked: (uris: string[]) => void;
  disabled?: boolean;
  autoOpen?: boolean;
}

export function BatchImagePicker({
  currentCount,
  maxCount,
  onImagesPicked,
  disabled,
  autoOpen,
}: BatchImagePickerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const remaining = maxCount - currentCount;
  const autoOpenFired = useRef(false);

  const handlePick = useCallback(async () => {
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    onImagesPicked(result.assets.map((a) => a.uri));
  }, [remaining, onImagesPicked]);

  useEffect(() => {
    if (autoOpen && !autoOpenFired.current && !disabled && remaining > 0) {
      autoOpenFired.current = true;
      handlePick();
    }
  }, [autoOpen, disabled, remaining, handlePick]);

  // Compact hint when max is reached
  if (remaining <= 0) {
    return (
      <View style={styles.maxReached}>
        <Text style={styles.maxReachedText}>
          {currentCount}/{maxCount} photos
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={handlePick}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {currentCount === 0
          ? "Select Photos"
          : `Add More Photos (${remaining} remaining)`}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    button: {
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderStyle: "dashed",
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.accent.primary,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
    },
    buttonTextDisabled: {
      color: colors.text.disabled,
    },
    maxReached: {
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    maxReachedText: {
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.xs,
    },
  });
