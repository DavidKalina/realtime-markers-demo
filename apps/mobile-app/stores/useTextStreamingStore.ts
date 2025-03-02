// hooks/useTextStreamingStore.ts - Enhanced for smoother transitions
import { create } from "zustand";
import * as Haptics from "expo-haptics";

interface TextStreamingState {
  currentStreamedText: string;
  isTyping: boolean;
  currentEmoji: string;
  lastStreamedText: string;
  streamCount: number;
  cancelationRequested: boolean;
  simulateTextStreaming: (text: string) => Promise<void>;
  setCurrentEmoji: (emoji: string) => void;
  resetText: () => void;
  cancelCurrentStreaming: () => void;
}

export const useTextStreamingStore = create<TextStreamingState>((set, get) => ({
  currentStreamedText: "",
  currentEmoji: "",
  isTyping: false,
  lastStreamedText: "",
  streamCount: 0,
  cancelationRequested: false,

  setCurrentEmoji: (emoji: string) => set({ currentEmoji: emoji }),

  cancelCurrentStreaming: () => {
    set({
      cancelationRequested: true,
      isTyping: false,
    });

    setTimeout(() => {
      set({ cancelationRequested: false });
    }, 100);
  },

  simulateTextStreaming: async (text: string) => {
    // Reset cancelation flag at the start
    set({ cancelationRequested: false });

    // Skip if text is empty
    if (!text || text.length === 0) {
      return;
    }

    // Handle already typing scenario
    if (get().isTyping) {
      if (text !== get().lastStreamedText) {
        // Cancel current streaming and reset
        set({
          isTyping: false,
          cancelationRequested: true,
        });

        // Small delay before starting new text
        await new Promise((resolve) => setTimeout(resolve, 150));
        set({ cancelationRequested: false });
      } else {
        return;
      }
    }

    // Skip if this is the exact same text we just streamed and we're not already typing
    if (text === get().lastStreamedText && !get().isTyping) {
      console.warn("TextStreamingStore: Duplicate text streaming request ignored");
      return;
    }

    // Update state for streaming start
    set({
      isTyping: true,
      currentStreamedText: "", // Start with empty string
      lastStreamedText: text,
      streamCount: get().streamCount + 1,
    });

    // Provide haptic feedback to indicate message is coming
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let currentText = "";
    let lastRenderTime = Date.now();
    const minRenderInterval = 16; // ~60fps, prevents too frequent renders

    try {
      // Adaptive typing speed based on message characteristics
      const getTypingSpeed = (message: string, index: number) => {
        // Faster at the beginning to give a quick response feeling
        if (index < 5) return 15;

        // Faster for emoji
        if (/\p{Emoji}/u.test(message[index])) return 10;

        // Slow down for punctuation to create natural pauses
        if ([".", ",", "!", "?", ";", ":"].includes(message[index])) return 40;

        // Default typing speed based on message length
        const baseSpeed = message.length < 30 ? 18 : message.length < 60 ? 22 : 25;

        // Add slight randomness for natural feel
        return baseSpeed + Math.floor(Math.random() * 8) - 4;
      };

      // Use a buffer to batch character additions
      let buffer = "";
      let lastHapticTime = 0;
      const hapticInterval = 300; // Reduced haptic frequency for smoother experience

      for (let i = 0; i < text.length; i++) {
        // Check if cancelation was requested
        if (get().cancelationRequested) {
          break;
        }

        // Add character to buffer
        buffer += text[i];
        currentText += text[i];

        // Trigger haptic feedback with rate limiting for longer text only
        const now = Date.now();
        if (text.length > 50 && now - lastHapticTime >= hapticInterval && i % 15 === 0) {
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

        // Wait before adding the next character - dynamic typing speed
        await new Promise((resolve) => setTimeout(resolve, getTypingSpeed(text, i)));
      }

      // Final haptic to signal completion
      if (text.length > 10) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("TextStreamingStore: Error during text streaming:", error);
    }

    // Use a timeout before setting isTyping to false to prevent visual glitches
    setTimeout(() => {
      set({ isTyping: false });
    }, 50);
  },

  resetText: () => {
    set({
      currentStreamedText: "",
      isTyping: false,
      cancelationRequested: false,
    });
  },
}));
