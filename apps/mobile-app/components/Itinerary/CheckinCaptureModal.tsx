import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Camera, X, XCircle } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { apiClient } from "@/services/ApiClient";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";


// Each widget gets a parallax multiplier — lower = moves slower = feels further back
const PARALLAX = [1.0, 0.92, 0.84, 0.78, 0.72];

interface CheckinCaptureModalProps {
  visible: boolean;
  objectiveId: string;
  sidequestId?: string;
  objectiveTitle: string;
  objectiveEmoji?: string;
  suggestedActivities: string[];
  actionItems?: string[];
  journalPrompt?: string;
  /** "venue" (default) shows full capture UI; "challenge" hides photo, requires journal, uses completeChallenge API */
  mode?: "venue" | "challenge";
  onDismiss: () => void;
  onComplete: () => void;
}

// ── Parallax widget wrapper ───────────────────────────────────────────

const ParallaxWidget: React.FC<{
  scrollY: SharedValue<number>;
  index: number;
  enterDelay: number;
  children: React.ReactNode;
}> = ({ scrollY, index, enterDelay, children }) => {
  const rate = PARALLAX[index] ?? 0.7;

  const parallaxStyle = useAnimatedStyle(() => {
    const offset = scrollY.value * (1 - rate);
    return {
      transform: [{ translateY: -offset }],
    };
  });

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400)}>
      <Animated.View style={parallaxStyle}>
        {children}
      </Animated.View>
    </Animated.View>
  );
};

// ── Component ─────────────────────────────────────────────────────────

export function CheckinCaptureModal({
  visible,
  objectiveId,
  sidequestId,
  objectiveTitle,
  objectiveEmoji,
  suggestedActivities,
  actionItems,
  journalPrompt,
  mode = "venue",
  onDismiss,
  onComplete,
}: CheckinCaptureModalProps) {
  const isChallenge = mode === "challenge";
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const scrollY = useSharedValue(0);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [customActivity, setCustomActivity] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [socialContext, setSocialContext] = useState<string | null>(null);
  const [journalText, setJournalText] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setSelectedActivities(new Set());
    setCustomActivity("");
    setShowCustomInput(false);
    setSocialContext(null);
    setJournalText("");
    setSaving(false);
    scrollY.value = 0;
  }, [scrollY]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const handleTakePhoto = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const handleToggleActivity = useCallback((activity: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activity)) {
        next.delete(activity);
      } else {
        next.add(activity);
      }
      return next;
    });
  }, []);

  const handleOther = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCustomInput((prev) => !prev);
  }, []);

  const journalMeetsMinimum = journalText.trim().length >= 20;

  const handleSave = useCallback(async () => {
    if (isChallenge && !journalMeetsMinimum) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const parts = [...selectedActivities];
      if (customActivity.trim()) parts.push(customActivity.trim());
      const activity = parts.length > 0 ? parts.join(" · ") : undefined;
      const journal = journalText.trim() || undefined;

      if (isChallenge && sidequestId) {
        // Challenge: atomic journal + check-in via completeChallenge
        await apiClient.sidequests.completeChallenge(sidequestId, objectiveId, {
          journalEntry: journal!,
          completedActivity: activity,
          socialContext: socialContext ?? undefined,
        });
      } else {
        // Venue: save journal separately (check-in already happened via proximity)
        await apiClient.sidequests.updateObjectiveJournal(objectiveId, {
          journalEntry: journal,
          completedActivity: activity,
          photoUrl: photoUri ?? undefined,
          socialContext: socialContext ?? undefined,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onComplete();
    } catch (err) {
      console.error("[CheckinCapture] Save failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaving(false);
    }
  }, [isChallenge, sidequestId, objectiveId, selectedActivities, customActivity, journalText, photoUri, socialContext, journalMeetsMinimum, reset, onComplete]);

  const handleSkip = useCallback(() => {
    reset();
    onDismiss();
  }, [reset, onDismiss]);

  if (!visible) return null;

  let widgetIdx = 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={s.container}
      >
        <BlurView
          tint="dark"
          intensity={60}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Close */}
        <Pressable style={s.closeButton} hitSlop={16} onPress={handleSkip}>
          <X size={18} color={colors.text.secondary} />
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.keyboardView}
        >
          <Animated.ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Header ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={100}>
              <View style={s.headerWidget}>
                <Text style={s.headerEmoji}>
                  {objectiveEmoji ?? "\u2728"}
                </Text>
                <Text style={s.headerTitle}>{objectiveTitle}</Text>
                <Text style={s.headerSub}>
                  {isChallenge ? "How did it go?" : "Nice! Capture this moment."}
                </Text>
              </View>
            </ParallaxWidget>

            {/* ── Photo (venue only) ── */}
            {!isChallenge && (
              <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={200}>
                <Text style={s.widgetLabel}>PHOTO</Text>
                {photoUri ? (
                  <View style={s.photoPreview}>
                    <Image source={{ uri: photoUri }} style={s.photoImage} />
                    <Pressable
                      style={s.photoRemove}
                      onPress={() => setPhotoUri(null)}
                    >
                      <XCircle size={20} color={colors.text.secondary} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.photoButton} onPress={handleTakePhoto}>
                    <Camera size={18} color={colors.accent.primary} />
                    <Text style={s.photoButtonText}>Take a photo</Text>
                  </Pressable>
                )}
              </ParallaxWidget>
            )}

            {/* ── Activity ── */}
            {suggestedActivities.length > 0 && (
              <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={300}>
                <Text style={s.widgetLabel}>WHAT DID YOU DO?</Text>
                <View style={s.chipGrid}>
                  {suggestedActivities.map((activity) => {
                    const isActive = selectedActivities.has(activity);
                    return (
                      <Pressable
                        key={activity}
                        style={[s.chip, isActive && s.chipActive]}
                        onPress={() => handleToggleActivity(activity)}
                      >
                        <Text
                          style={[s.chipText, isActive && s.chipTextActive]}
                        >
                          {activity}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={[s.chip, { borderRadius: radius.full, alignSelf: "flex-start" }, showCustomInput && s.chipActive]}
                    onPress={handleOther}
                  >
                    <Text
                      style={[s.chipText, showCustomInput && s.chipTextActive]}
                    >
                      Other...
                    </Text>
                  </Pressable>
                </View>
                {showCustomInput && (
                  <TextInput
                    style={s.textInput}
                    placeholder="What did you do?"
                    placeholderTextColor={colors.text.disabled}
                    value={customActivity}
                    onChangeText={setCustomActivity}
                    maxLength={100}
                    autoFocus
                  />
                )}
              </ParallaxWidget>
            )}

            {/* ── Social context ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={350}>
              <Text style={s.widgetLabel}>WHO WERE YOU WITH?</Text>
              <View style={s.socialGrid}>
                {([
                  { key: "solo", label: "\uD83E\uDDD1 Solo" },
                  { key: "with_someone", label: "\uD83D\uDC6B With someone" },
                  { key: "met_someone_new", label: "\uD83D\uDC4B Met someone new" },
                  { key: "group_activity", label: "\uD83D\uDC65 Group activity" },
                ] as const).map(({ key, label }) => {
                  const isActive = socialContext === key;
                  return (
                    <Pressable
                      key={key}
                      style={[s.chip, { borderRadius: radius.full }, isActive && s.chipActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSocialContext(isActive ? null : key);
                      }}
                    >
                      <Text
                        style={[s.chipText, isActive && s.chipTextActive]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ParallaxWidget>

            {/* ── Journal ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={450}>
              <Text style={s.widgetLabel}>
                {journalPrompt
                  ? `\u201C${journalPrompt}\u201D`
                  : isChallenge ? "REFLECT ON THIS" : "ANY THOUGHTS?"}
              </Text>
              <TextInput
                style={[s.textInput, s.journalInput]}
                placeholder={isChallenge
                  ? "Write a short reflection to complete this challenge..."
                  : "Optional \u2014 even one word counts"}
                placeholderTextColor={colors.text.disabled}
                value={journalText}
                onChangeText={setJournalText}
                multiline
                numberOfLines={isChallenge ? 5 : 3}
                maxLength={2000}
                textAlignVertical="top"
              />
              {isChallenge && journalText.trim().length > 0 && !journalMeetsMinimum && (
                <Text style={s.journalHint}>
                  Keep going — {20 - journalText.trim().length} more characters
                </Text>
              )}
            </ParallaxWidget>

            {/* ── Actions ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={550}>
              <Pressable
                style={[
                  s.saveButton,
                  (saving || (isChallenge && !journalMeetsMinimum)) && s.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || (isChallenge && !journalMeetsMinimum)}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={s.saveButtonText}>
                    {isChallenge ? "Complete Challenge" : "Save"}
                  </Text>
                )}
              </Pressable>
              {!isChallenge && (
                <Pressable style={s.skipButton} onPress={handleSkip} disabled={saving}>
                  <Text style={s.skipButtonText}>Skip for now</Text>
                </Pressable>
              )}
            </ParallaxWidget>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    closeButton: {
      position: "absolute",
      top: 56,
      right: 20,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 100,
      paddingHorizontal: 28,
      paddingBottom: 80,
      gap: spacing["2xl"],
    },

    // ── Header ──
    headerWidget: {
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerEmoji: {
      fontSize: 48,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 12,
    },
    headerTitle: {
      fontFamily: fontFamily.display,
      fontSize: 22,
      color: colors.text.primary,
      textAlign: "center",
      lineHeight: 28,
    },
    headerSub: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: "center",
      letterSpacing: 0.5,
    },

    // ── Widget label ──
    widgetLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },

    // ── Photo ──
    photoButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderWidth: 1,
      borderColor: `rgba(${colors.accent.rgb}, 0.2)`,
      borderStyle: "dashed",
      borderRadius: radius.lg,
      backgroundColor: `rgba(${colors.accent.rgb}, 0.04)`,
    },
    photoButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.accent.primary,
      fontWeight: fontWeight.semibold,
    },
    photoPreview: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    photoImage: {
      width: 100,
      height: 75,
      borderRadius: radius.md,
    },
    photoRemove: {
      marginTop: -2,
    },

    // ── Activity chips ──
    chipGrid: {
      gap: spacing.sm,
    },
    socialGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    chipActive: {
      borderColor: `rgba(${colors.accent.rgb}, 0.4)`,
      backgroundColor: colors.accent.muted,
    },
    chipText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    chipTextActive: {
      color: colors.accent.primary,
    },

    // ── Text inputs ──
    textInput: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      marginTop: spacing.sm,
    },
    journalInput: {
      height: 90,
      textAlignVertical: "top",
    },
    journalHint: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.disabled,
      marginTop: spacing.xs,
    },

    // ── Actions ──
    saveButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      width: "100%",
      alignItems: "center",
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#000000",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    skipButton: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    skipButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
  });
