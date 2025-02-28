// hooks/useTextStreamingStore.ts - Enhanced with debugging
import { create } from "zustand";
import * as Haptics from "expo-haptics";

interface TextStreamingState {
  currentStreamedText: string;
  isTyping: boolean;
  simulateTextStreaming: (text: string) => Promise<void>;
  resetText: () => void;
}

export const useTextStreamingStore = create<TextStreamingState>((set, get) => ({
  currentStreamedText: "",
  isTyping: false,

  simulateTextStreaming: async (text: string) => {
    console.log(`TextStreamingStore: Starting text streaming - "${text}"`);

    if (!text || text.length === 0) {
      console.warn("TextStreamingStore: Empty text received, nothing to stream");
      return;
    }

    set({ isTyping: true, currentStreamedText: "" });

    // Fix for text reversal bug: Add text character by character in correct order
    let currentText = "";

    try {
      for (let i = 0; i < text.length; i++) {
        // Trigger a subtle haptic every 5 characters to reduce vibration
        if (i % 5 === 0) {
          Haptics.selectionAsync();
        }

        // Add next character to the current text
        currentText += text[i];

        // Important: Create a new string to ensure React detects the state change
        set({ currentStreamedText: currentText });

        // Wait before adding the next character - use shorter delay for testing
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      console.log(`TextStreamingStore: Finished text streaming - "${text}"`);
    } catch (error) {
      console.error("TextStreamingStore: Error during text streaming:", error);
    }

    set({ isTyping: false });
  },

  resetText: () => {
    console.log("TextStreamingStore: Resetting text");
    set({ currentStreamedText: "", isTyping: false });
  },
}));
