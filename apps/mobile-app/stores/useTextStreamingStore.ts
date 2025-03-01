// hooks/useTextStreamingStore.ts - Improved text streaming
import { create } from "zustand";
import * as Haptics from "expo-haptics";

interface TextStreamingState {
  currentStreamedText: string;
  isTyping: boolean;
  currentEmoji: string;
  lastStreamedText: string; // Track the last message we streamed
  streamCount: number; // Track how many times we've streamed
  simulateTextStreaming: (text: string) => Promise<void>;
  setCurrentEmoji: (emoji: string) => void;

  resetText: () => void;
}

export const useTextStreamingStore = create<TextStreamingState>((set, get) => ({
  currentStreamedText: "",
  currentEmoji: "",
  isTyping: false,
  lastStreamedText: "",
  streamCount: 0,
  setCurrentEmoji: (emoji: string) => set({ currentEmoji: emoji }),

  simulateTextStreaming: async (text: string) => {
    console.log(`TextStreamingStore: Starting text streaming - "${text}"`);

    // Skip if text is empty
    if (!text || text.length === 0) {
      console.warn("TextStreamingStore: Empty text received, nothing to stream");
      return;
    }

    // If we're already typing, finish current message immediately if it's different
    if (get().isTyping && text !== get().lastStreamedText) {
      console.log("TextStreamingStore: Already typing, immediately finishing current message");
      // Immediately complete the current text and start the new one
      set({
        isTyping: true,
        currentStreamedText: get().lastStreamedText,
        lastStreamedText: text,
        streamCount: get().streamCount + 1,
      });

      // Small delay before starting new text
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else if (get().isTyping) {
      console.warn("TextStreamingStore: Already typing same message, request ignored");
      return;
    }

    // Skip if this is the exact same text we just streamed and we're not already typing
    if (text === get().lastStreamedText && !get().isTyping) {
      console.warn("TextStreamingStore: Duplicate text streaming request ignored");
      return;
    }

    set({
      isTyping: true,
      currentStreamedText: "",
      // Store this text as the last streamed text to prevent duplicates
      lastStreamedText: text,
      // Increment the stream count
      streamCount: get().streamCount + 1,
    });

    // Fix for text reversal bug: Add text character by character in correct order
    let currentText = "";

    try {
      // Use a faster typing speed for marker selection messages (identifiable by containing an emoji)
      const hasEmoji = /\p{Emoji}/u.test(text);
      const typingSpeed = hasEmoji ? 8 : 15; // Faster for event messages with emojis

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
        await new Promise((resolve) => setTimeout(resolve, typingSpeed));
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
