import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius, fontFamily, fontSize } from "@/theme";

interface BatchImagePickerProps {
  currentCount: number;
  maxCount: number;
  onImagesPicked: (uris: string[]) => void;
  disabled?: boolean;
}

export function BatchImagePicker({
  currentCount,
  maxCount,
  onImagesPicked,
  disabled,
}: BatchImagePickerProps) {
  const remaining = maxCount - currentCount;

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

  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={handlePick}
      disabled={disabled || remaining <= 0}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {currentCount === 0
          ? "Select Photos"
          : remaining > 0
            ? `Add More Photos (${remaining} remaining)`
            : "Maximum photos selected"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
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
});
