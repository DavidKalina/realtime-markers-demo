import React, { useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
} from "react-native";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";

interface IdealDayStepProps {
  value: string;
  onChange: (text: string) => void;
}

export const IdealDayStep: React.FC<IdealDayStepProps> = ({
  value,
  onChange,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={120}
      >
        <Text style={styles.title}>Your ideal day out</Text>
        <Text style={styles.subtitle}>
          Describe your perfect day — we'll use this to shape your
          recommendations.
        </Text>

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="Coffee at a quiet cafe, then a street art walk, ending with live jazz at sunset..."
          placeholderTextColor={colors.text.secondary}
          multiline
          textAlignVertical="top"
          maxLength={500}
        />

        <Text style={styles.charCount}>{value.length}/500</Text>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing["3xl"],
      paddingTop: spacing["3xl"],
    },
    title: {
      fontSize: fontSize["3xl"],
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: lineHeight.relaxed,
      marginBottom: spacing["3xl"],
    },
    input: {
      flex: 1,
      maxHeight: 200,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.lg,
      backgroundColor: colors.bg.elevated,
      padding: spacing.lg,
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: lineHeight.relaxed,
    },
    charCount: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      textAlign: "right",
      marginTop: spacing.sm,
    },
  });
