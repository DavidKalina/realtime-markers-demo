// stores/messageQueueStore.ts
import { create } from "zustand";

interface MessageQueueState {
  messages: string[];
  version: number;
  markerId: string | null;
}

interface MessageQueueStore extends MessageQueueState {
  queueMessages: (messages: string[], markerId?: string | null) => void;
  clearMessages: () => void;
  clearMessagesImmediate: () => void;
}

export const useMessageQueueStore = create<MessageQueueStore>((set, get) => ({
  messages: [],
  version: 0,
  markerId: null,

  queueMessages: (messages: string[], markerId: string | null = null) => {
    if (!messages || messages.length === 0) return;

    set((prev) => {
      // Skip update if the content is identical to the current state
      if (
        prev.markerId === markerId &&
        JSON.stringify(prev.messages) === JSON.stringify(messages)
      ) {
        return prev;
      }

      return {
        ...prev,
        messages: [...messages],
        version: prev.version + 1,
        markerId,
      };
    });
  },

  clearMessages: () => {
    // Clear the message queue and update version and markerId
    set((prev) => ({
      messages: [],
      version: prev.version + 1,
      markerId: null,
    }));
  },

  clearMessagesImmediate: () => {
    // Immediate clear without additional processing delay
    set((prev) => ({
      messages: [],
      version: prev.version + 1,
      markerId: null,
    }));
  },
}));
