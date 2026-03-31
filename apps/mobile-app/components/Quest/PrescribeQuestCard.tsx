import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColors, fontFamily, spacing, type Colors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { useUserLocation } from "@/contexts/LocationContext";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import PrescribeOverlay from "./PrescribeOverlay";

const GREEN_ACCENT = "#86efac";
const GREEN_BG = "rgba(134, 239, 172, 0.08)";
const GREEN_BORDER = "rgba(134, 239, 172, 0.2)";

type Phase = "idle" | "generating" | "ready";

interface PrescribeQuestCardProps {
  onQuestAccepted?: (sidequestId: string) => void;
}

function PrescribeQuestCard({ onQuestAccepted }: PrescribeQuestCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { userLocation } = useUserLocation();
  const { trackJob, activeJobs, stepLabel, dismissJob } =
    useJobProgressContext();

  const [phase, setPhase] = useState<Phase>("idle");
  const [quest, setQuest] = useState<SidequestResponse | null>(null);
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

  // Button press scale
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  // Pulse for generating
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Watch job
  const activeJob = useMemo(
    () => (trackedJobId ? activeJobs.find((j) => j.jobId === trackedJobId) : null),
    [activeJobs, trackedJobId],
  );

  React.useEffect(() => {
    if (!activeJob || phase !== "generating") return;

    if (activeJob.status === "completed") {
      const sid =
        (activeJob.result?.sidequestId as string) ?? activeJob.itineraryId;
      if (sid) {
        apiClient.sidequests
          .getById(sid)
          .then((sq) => {
            setQuest(sq);
            setPhase("ready");
            pulse.value = 1;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (trackedJobId) dismissJob(trackedJobId);
          })
          .catch(() => {
            setPhase("idle");
            pulse.value = 1;
          });
      }
    } else if (activeJob.status === "failed") {
      setPhase("idle");
      pulse.value = 1;
      if (trackedJobId) dismissJob(trackedJobId);
    }
  }, [activeJob, phase, trackedJobId, pulse, dismissJob]);

  const handlePress = useCallback(async () => {
    if (!userLocation) return;

    // Animate button
    btnScale.value = withSequence(
      withTiming(0.94, { duration: 80, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) }),
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("generating");
    pulse.value = withRepeat(
      withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    try {
      const result = await apiClient.sidequests.prescribeQuest({
        latitude: userLocation[1],
        longitude: userLocation[0],
        timezone: getUserTimezone(),
      });
      setTrackedJobId(result.jobId);
      trackJob(result.jobId);
    } catch (err: unknown) {
      setPhase("idle");
      pulse.value = 1;
      // Check for daily limit (429)
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "";
      if (msg.includes("daily limit") || msg.includes("429")) {
        setCooldownMessage(msg || "Daily limit reached. Come back tomorrow!");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [userLocation, trackJob, btnScale, pulse]);

  const handleAccept = useCallback(async () => {
    if (!quest) return;
    setIsAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiClient.sidequests.activate(quest.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("idle");
      setQuest(null);
      onQuestAccepted?.(quest.id);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAccepting(false);
    }
  }, [quest, onQuestAccepted]);

  const handleDismiss = useCallback(() => {
    const dismissedId = quest?.id;
    setPhase("idle");
    setQuest(null);
    if (dismissedId) {
      apiClient.sidequests.deleteById(dismissedId).catch((err) => {
        console.error("[PrescribeQuestCard] Failed to delete dismissed quest:", err);
      });
    }
  }, [quest?.id]);

  return (
    <>
      <Reanimated.View style={[s.bar, btnStyle]}>
        {phase === "idle" && cooldownMessage && (
          <Text style={s.cooldownText}>{cooldownMessage}</Text>
        )}

        {phase === "idle" && !cooldownMessage && (
          <Pressable style={s.button} onPress={handlePress} disabled={!userLocation}>
            <Text style={s.buttonText}>Get Your Next Quest</Text>
          </Pressable>
        )}

        {phase === "generating" && (
          <Reanimated.View style={[s.generatingRow, pulseStyle]}>
            <ActivityIndicator size="small" color={GREEN_ACCENT} />
            <Text style={s.generatingText}>
              {stepLabel || "Analyzing your comfort zone..."}
            </Text>
          </Reanimated.View>
        )}

        {phase === "ready" && (
          <Pressable style={s.button} onPress={() => setPhase("ready")}>
            <Text style={s.buttonText}>View Your Quest</Text>
          </Pressable>
        )}
      </Reanimated.View>

      <PrescribeOverlay
        visible={phase === "ready" && quest != null}
        card={quest}
        isAccepting={isAccepting}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
      />
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: GREEN_BG,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopWidth: 1,
      borderColor: GREEN_BORDER,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    button: {
      alignItems: "center",
      paddingVertical: 2,
    },
    buttonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    generatingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: 2,
    },
    generatingText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    cooldownText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textAlign: "center",
      paddingVertical: 2,
    },
  });

export default React.memo(PrescribeQuestCard);
