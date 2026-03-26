import type { ConversationStep } from "@/hooks/useConversationEngine";
import {
  ACTIVITY_OPTIONS,
  INTENTION_OPTIONS,
} from "@/constants/adventureOptions";
import { useConversationStore } from "@/stores/useConversationStore";

export interface BuildSidequestStepsOptions {
  /** User display name for the greeting */
  displayName?: string;
  /** Pre-selected activity types (skips the vibes step) */
  defaultActivities?: string[];
}

/**
 * Build the standard sidequest conversation steps.
 * Vibes → Intention → Duration → Time of day → Where (near me / pick on map) → Generating
 */
export function buildSidequestSteps(
  options?: BuildSidequestStepsOptions,
): ConversationStep[] {
  const vibeOpts = ACTIVITY_OPTIONS.map((a) => ({
    label: a.label,
    value: a.value,
    emoji: a.emoji,
  }));
  const intentOpts = INTENTION_OPTIONS.map((i) => ({
    label: i.label,
    value: i.value,
    emoji: i.emoji,
  }));

  const name = options?.displayName || "adventurer";
  const preSelected = options?.defaultActivities;

  // If activities are pre-selected, skip vibes and go straight to intention
  if (preSelected && preSelected.length > 0) {
    const labels = preSelected
      .map((v) => ACTIVITY_OPTIONS.find((a) => a.value === v)?.label)
      .filter(Boolean);

    return [
      {
        prompt: `Hey ${name}! Looks like you're into ${labels.join(", ")}. What's the intention?`,
        options: intentOpts,
        hideInput: true,
        onResponse: (intention) =>
          buildTimingStep(preSelected, intention, labels as string[]),
      },
    ];
  }

  return [
    {
      prompt: `Hey ${name}! What vibes are you feeling today?`,
      options: vibeOpts,
      multiSelect: true,
      hideInput: true,
      onResponse: (vibes) => {
        const picked = vibes.split(",");
        const labels = picked
          .map((v) => ACTIVITY_OPTIONS.find((a) => a.value === v)?.label)
          .filter(Boolean);
        return [
          {
            prompt: `${labels.join(", ")} — nice combo. What's the intention?`,
            options: intentOpts,
            hideInput: true,
            onResponse: (intention) =>
              buildTimingStep(picked, intention, labels as string[]),
          },
        ];
      },
    },
  ];
}

/** Duration + time-of-day on one screen — rendered via TimingPickerContent */
function buildTimingStep(
  activityTypes: string[],
  intention: string,
  labels: string[],
): ConversationStep {
  return {
    prompt: "How much time do you have, and when?",
    contentType: "timing-picker" as const,
    hideInput: true,
    onResponse: () => {
      // duration + timeOfDay already merged into store by TimingPickerContent
      return buildWhereStep(activityTypes, intention, labels);
    },
  };
}

/** Shared "where" step — unified map picker for both near-me and pin selection */
function buildWhereStep(
  activityTypes: string[],
  _intention: string,
  labels: string[],
): ConversationStep {
  const store = useConversationStore.getState();
  store.mergeData({ activityTypes, intention: _intention });
  store.setMapPins([]);

  return {
    prompt: "Where should we look? Drop pins or just hit go for nearby.",
    contentType: "map-picker" as const,
    hideInput: true,
    onResponse: () => {
      const hasPins =
        useConversationStore.getState().data?.mapPins &&
        useConversationStore.getState().data!.mapPins!.length > 0;
      const desc = hasPins ? "around your pins" : "near you";
      return {
        prompt: `Curating a ${labels.join(" + ")} sidequest ${desc}...`,
        contentType: "generating" as const,
        hideInput: true,
      };
    },
  };
}
