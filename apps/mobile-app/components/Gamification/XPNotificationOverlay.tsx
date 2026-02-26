import React, { useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import {
  eventBroker,
  EventTypes,
  type XPAwardedEvent,
  type LevelUpdateEvent,
} from "@/services/EventBroker";
import { getTierByName } from "@/utils/gamification";
import { useXPStore } from "@/stores/useXPStore";

/**
 * Silent listener — accumulates XP events into the store
 * instead of showing inline toasts. The badge on the "Me" tab
 * and the profile page handle the visual feedback.
 */
const XPNotificationOverlay: React.FC = () => {
  const addXP = useXPStore((s) => s.addXP);
  const setLevelUp = useXPStore((s) => s.setLevelUp);

  const handleXPAwarded = useCallback(
    (event: XPAwardedEvent) => {
      if (event.data?.amount) {
        addXP(event.data.amount, event.data.action || "unknown");
      }
    },
    [addXP],
  );

  const handleLevelUpdate = useCallback(
    (event: LevelUpdateEvent) => {
      if (event.data?.action === "level_up" && event.data?.title) {
        const tier = getTierByName(event.data.title);
        setLevelUp(tier.name, tier.emoji);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [setLevelUp],
  );

  useEffect(() => {
    const unsubXP = eventBroker.on<XPAwardedEvent>(
      EventTypes.XP_AWARDED,
      handleXPAwarded,
    );
    const unsubLevel = eventBroker.on<LevelUpdateEvent>(
      EventTypes.LEVEL_UPDATE,
      handleLevelUpdate,
    );

    return () => {
      unsubXP();
      unsubLevel();
    };
  }, [handleXPAwarded, handleLevelUpdate]);

  return null;
};

export default XPNotificationOverlay;
