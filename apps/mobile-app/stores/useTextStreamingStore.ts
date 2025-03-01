// hooks/useTextStreamingStore.ts - With added ability to cancel streaming
import { create } from "zustand";
import * as Haptics from "expo-haptics";

interface TextStreamingState {
  currentStreamedText: string;
  isTyping: boolean;
  currentEmoji: string;
  lastStreamedText: string; // Track the last message we streamed
  streamCount: number; // Track how many times we've streamed
  cancelationRequested: boolean; // New flag to request cancelation
  simulateTextStreaming: (text: string) => Promise<void>;
  setCurrentEmoji: (emoji: string) => void;
  resetText: () => void;
  cancelCurrentStreaming: () => void; // New method to cancel current streaming
}

export const useTextStreamingStore = create<TextStreamingState>((set, get) => ({
  currentStreamedText: "",
  currentEmoji: "",
  isTyping: false,
  lastStreamedText: "",
  streamCount: 0,
  cancelationRequested: false,

  setCurrentEmoji: (emoji: string) => set({ currentEmoji: emoji }),

  // Add method to request cancelation of current streaming
  cancelCurrentStreaming: () => {
    console.log("TextStreamingStore: Canceling current text streaming");
    set({
      cancelationRequested: true,
      isTyping: false, // Force typing to end immediately
    });

    // Reset the cancelation flag after a short delay
    setTimeout(() => {
      set({ cancelationRequested: false });
    }, 100);
  },

  simulateTextStreaming: async (text: string) => {
    console.log(`TextStreamingStore: Starting text streaming - "${text}"`);

    // Reset cancelation flag at the start
    set({ cancelationRequested: false });

    // Skip if text is empty
    if (!text || text.length === 0) {
      console.warn("TextStreamingStore: Empty text received, nothing to stream");
      return;
    }

    // If we're already typing, handle it more gracefully
    if (get().isTyping) {
      if (text !== get().lastStreamedText) {
        console.log("TextStreamingStore: Already typing, finishing current message first");
        // Set a flag to avoid state thrashing
        set((state) => ({
          isTyping: false,
          currentStreamedText: state.lastStreamedText,
        }));

        // Small delay before starting new text to prevent flickering
        await new Promise((resolve) => setTimeout(resolve, 150));
      } else {
        console.warn("TextStreamingStore: Already typing same message, request ignored");
        return;
      }
    }

    // Skip if this is the exact same text we just streamed and we're not already typing
    if (text === get().lastStreamedText && !get().isTyping) {
      console.warn("TextStreamingStore: Duplicate text streaming request ignored");
      return;
    }

    // Use a single state update to reduce React re-renders
    set({
      isTyping: true,
      currentStreamedText: "", // Start with empty string
      lastStreamedText: text,
      streamCount: get().streamCount + 1,
    });

    let currentText = "";
    let lastRenderTime = Date.now();
    const minRenderInterval = 16; // ~60fps, prevents too frequent renders

    try {
      // Determine typing speed - faster for emoji messages
      const hasEmoji = /\p{Emoji}/u.test(text);
      const typingSpeed = hasEmoji ? 8 : 15;

      // Use a buffer to batch character additions
      let buffer = "";
      let lastHapticTime = 0;
      const hapticInterval = 200; // Limit haptics to reduce interference

      for (let i = 0; i < text.length; i++) {
        // Check if cancelation was requested
        if (get().cancelationRequested) {
          console.log("TextStreamingStore: Streaming canceled");
          break;
        }

        // Add character to buffer
        buffer += text[i];
        currentText += text[i];

        // Trigger haptic feedback with rate limiting
        const now = Date.now();
        if (now - lastHapticTime >= hapticInterval && i % 5 === 0) {
          Haptics.selectionAsync();
          lastHapticTime = now;
        }

        // Only update state at controlled intervals to prevent flickering
        if (now - lastRenderTime >= minRenderInterval || i === text.length - 1) {
          // Important: Create a completely new string to ensure React detects the state change
          set({ currentStreamedText: String(currentText) });
          buffer = "";
          lastRenderTime = now;
        }

        // Wait before adding the next character
        await new Promise((resolve) => setTimeout(resolve, typingSpeed));
      }

      console.log(`TextStreamingStore: Finished text streaming - "${text}"`);
    } catch (error) {
      console.error("TextStreamingStore: Error during text streaming:", error);
    }

    // Use a timeout before setting isTyping to false to prevent visual glitches
    setTimeout(() => {
      set({ isTyping: false });
    }, 50);
  },

  resetText: () => {
    console.log("TextStreamingStore: Resetting text");
    set({
      currentStreamedText: "",
      isTyping: false,
      cancelationRequested: false,
    });
  },
}));
