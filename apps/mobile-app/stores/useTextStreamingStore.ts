// hooks/useTextStreamingStore.ts
import { create } from "zustand";
import * as Haptics from "expo-haptics";

interface TextStreamingState {
  currentStreamedText: string;
  isTyping: boolean;
  simulateTextStreaming: (text: string) => Promise<void>;
}

export const useTextStreamingStore = create<TextStreamingState>((set, get) => ({
  currentStreamedText: "",
  isTyping: false,

  simulateTextStreaming: async (text: string) => {
    set({ isTyping: true, currentStreamedText: "" });

    // Fix for text reversal bug: Add text character by character in correct order
    let currentText = "";
    for (let i = 0; i < text.length; i++) {
      // Trigger a subtle haptic every 3 characters
      if (i % 3 === 0) {
        Haptics.selectionAsync();
      }

      // Add next character to the current text
      currentText += text[i];

      // Important: Create a new string to ensure React detects the state change
      set({ currentStreamedText: currentText });

      // Wait before adding the next character
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    set({ isTyping: false });
  },
}));
