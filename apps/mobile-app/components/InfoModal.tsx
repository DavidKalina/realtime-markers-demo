import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  useColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  type Colors,
} from "@/theme";

interface InfoModalProps {
  visible: boolean;
  title: string;
  body: string;
  accentColor?: string;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({
  visible,
  title,
  body,
  accentColor,
  onClose,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdropFill}
        />
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.card}
        >
          <Pressable>
            {accentColor && (
              <View
                style={[styles.accentBar, { backgroundColor: accentColor }]}
              />
            )}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable style={styles.dismissButton} onPress={onClose}>
              <Text style={styles.dismissText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.light,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    width: "85%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  accentBar: {
    height: 3,
    borderRadius: 2,
    width: 32,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.relaxed,
    marginBottom: spacing.xl,
  },
  dismissButton: {
    alignSelf: "flex-end",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.bg.elevated,
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
  },
});

export default InfoModal;
