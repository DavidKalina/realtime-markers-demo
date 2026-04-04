import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import CardOverlay from "../Itinerary/CardOverlay";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { fontFamily, spacing, useColors, type Colors } from "@/theme";

const GREEN_ACCENT = "#86efac";

interface BatchRevealOverlayProps {
  visible: boolean;
  quests: SidequestResponse[];
  onComplete: (acceptedIds: string[]) => void;
}

function BatchRevealOverlay({
  visible,
  quests,
  onComplete,
}: BatchRevealOverlayProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);

  // Reset state when quests change
  React.useEffect(() => {
    if (quests.length > 0) {
      setCurrentIndex(0);
      setAcceptedIds([]);
    }
  }, [quests]);

  const currentQuest = quests[currentIndex] ?? null;
  const isLast = currentIndex >= quests.length - 1;

  const advanceOrFinish = useCallback(
    (newAcceptedIds: string[]) => {
      if (isLast) {
        onComplete(newAcceptedIds);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [isLast, onComplete],
  );

  const handleAccept = useCallback(() => {
    if (!currentQuest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newAccepted = [...acceptedIds, currentQuest.id];
    setAcceptedIds(newAccepted);
    advanceOrFinish(newAccepted);
  }, [currentQuest, acceptedIds, advanceOrFinish]);

  const handleDismiss = useCallback(() => {
    if (!currentQuest) return;
    // Delete dismissed quest
    apiClient.sidequests.deleteById(currentQuest.id).catch((err) => {
      console.error("[BatchReveal] Failed to delete dismissed quest:", err);
    });
    advanceOrFinish(acceptedIds);
  }, [currentQuest, acceptedIds, advanceOrFinish]);

  if (!visible || quests.length === 0) return null;

  return (
    <>
      {quests.length > 1 && currentQuest && (
        <View style={s.counterContainer} pointerEvents="none">
          <Text style={s.counterText}>
            Quest {currentIndex + 1} of {quests.length}
          </Text>
        </View>
      )}
      <CardOverlay
        card={currentQuest}
        visible={visible && currentQuest != null}
        onDismiss={handleDismiss}
        onAccept={handleAccept}
        isAccepting={false}
      />
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    counterContainer: {
      position: "absolute",
      top: 60,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 1000,
    },
    counterText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      overflow: "hidden",
    },
  });

export default React.memo(BatchRevealOverlay);
