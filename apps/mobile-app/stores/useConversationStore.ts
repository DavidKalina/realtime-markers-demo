import { create } from "zustand";
import type { ConversationStep, TriggerSource } from "@/hooks/useConversationEngine";
import type { MapPin } from "@/components/Itinerary/MapPickerContent";

export interface ConversationData {
  activityTypes: string[];
  intention: string;
  mapPins?: MapPin[];
}

interface ConversationStore {
  /** Whether the overlay is visible (collapsed or expanded) */
  visible: boolean;
  /** Conversation steps to run */
  steps: ConversationStep[];
  /** Trigger source for the conversation */
  trigger: TriggerSource;
  /** Whether the dialog starts expanded */
  autoExpand: boolean;
  /** Collapsed bar label */
  collapsedLabel: string;
  /** Map pins dropped by the user */
  mapPins: MapPin[];
  /** Accumulated form data from conversation responses */
  data: ConversationData | null;
  /** Callback when conversation completes — stored as ref-like value */
  _onComplete: ((data: ConversationData) => void) | null;

  /** Show the conversation overlay and start a conversation */
  startConversation: (config: {
    steps: ConversationStep[];
    trigger?: TriggerSource;
    autoExpand?: boolean;
    collapsedLabel?: string;
    /** Custom completion handler. If omitted, the overlay uses default itinerary creation. */
    onComplete?: (data: ConversationData) => void;
  }) => void;

  /** Hide and reset the overlay */
  dismiss: () => void;

  /** Update map pins (called by MapPickerContent) */
  setMapPins: (pins: MapPin[]) => void;

  /** Set accumulated conversation data */
  setData: (data: ConversationData) => void;

  /** Merge partial data into existing data */
  mergeData: (partial: Partial<ConversationData>) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  visible: false,
  steps: [],
  trigger: "custom",
  autoExpand: false,
  collapsedLabel: "What's next?",
  mapPins: [],
  data: null,
  _onComplete: null,

  startConversation: (config) =>
    set({
      visible: true,
      steps: config.steps,
      trigger: config.trigger ?? "custom",
      autoExpand: config.autoExpand ?? false,
      collapsedLabel: config.collapsedLabel ?? "What's next?",
      mapPins: [],
      data: null,
      _onComplete: config.onComplete ?? null,
    }),

  dismiss: () =>
    set({
      visible: false,
      steps: [],
      autoExpand: false,
      mapPins: [],
      data: null,
      _onComplete: null,
    }),

  setMapPins: (pins) => set({ mapPins: pins }),

  setData: (data) => set({ data }),

  mergeData: (partial) => {
    const current = get().data;
    if (current) {
      set({ data: { ...current, ...partial } });
    } else {
      set({ data: { activityTypes: [], intention: "", ...partial } });
    }
  },
}));
