// hooks/useTextStreamingStore.ts - With fixes for stability
import { create } from "zustand";
import * as Haptics from "expo-haptics";

// Custom AbortError class since DOMException isn't available in React Native
class AbortError extends Error {
  name: string;

  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

interface TextStreamingState {
  currentStreamedText: string;
  isTyping: boolean;
  currentEmoji: string;
  lastStreamedText: string;
  streamCount: number;

  // Control fields
  streamingVersion: number;
  abortController: AbortController | null;

  // API methods
  simulateTextStreaming: (text: string) => Promise<void>;
  setCurrentEmoji: (emoji: string) => void;
  resetText: () => void;
  cancelCurrentStreaming: () => Promise<void>;
}

export const useTextStreamingStore = create<TextStreamingState>((set, get) => ({
  currentStreamedText: "",
  currentEmoji: "",
  isTyping: false,
  lastStreamedText: "",
  streamCount: 0,

  streamingVersion: 0,
  abortController: null,

  setCurrentEmoji: (emoji: string) => set({ currentEmoji: emoji }),

  cancelCurrentStreaming: async () => {
    const { abortController } = get();

    // Signal abortion if controller exists
    if (abortController) {
      abortController.abort();
    }

    // Increment version to prevent old streams from continuing
    const newVersion = get().streamingVersion + 1;

    // Reset state immediately - create a new state object to ensure update
    set((state) => ({
      ...state, // Keep other state
      abortController: null,
      isTyping: false,
      streamingVersion: newVersion,
      currentStreamedText: "",
      // Don't clear text here to prevent flicker
    }));

    return Promise.resolve();
  },

  simulateTextStreaming: async (text: string) => {
    // Skip if text is empty
    if (!text || text.length === 0) {
      return;
    }

    // Cancel any current streaming before starting
    await get().cancelCurrentStreaming();

    // Create new AbortController for this streaming session
    const abortController = new AbortController();
    const currentVersion = get().streamingVersion;

    // Set up initial state for new streaming session - use functional update
    set((state) => ({
      ...state,
      isTyping: true,
      currentStreamedText: "", // Start with empty string
      lastStreamedText: text,
      streamCount: state.streamCount + 1,
      abortController,
    }));

    // Provide haptic feedback to indicate message is coming
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Ignore haptic errors
    }

    let currentText = "";
    let lastRenderTime = Date.now();
    const minRenderInterval = 16; // ~60fps

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
        // Check if cancelation was requested via abort controller
        if (abortController.signal.aborted) {
          throw new AbortError("Aborted");
        }

        // Check if this streaming session is still the current version
        if (get().streamingVersion !== currentVersion) {
          throw new Error("Streaming version changed");
        }

        // Add character to buffer
        buffer += text[i];
        currentText += text[i];

        // Trigger haptic feedback with rate limiting for longer text only
        const now = Date.now();
        if (text.length > 50 && now - lastHapticTime >= hapticInterval && i % 15 === 0) {
          try {
            await Haptics.selectionAsync();
            lastHapticTime = now;
          } catch (e) {
            // Ignore haptic errors
          }
        }

        // Only update state at controlled intervals to prevent flickering
        if (now - lastRenderTime >= minRenderInterval || i === text.length - 1) {
          // Check cancellation again before updating state
          if (abortController.signal.aborted || get().streamingVersion !== currentVersion) {
            throw new AbortError("Aborted");
          }

          // Important: Create a completely new string to ensure React detects the state change
          // Use functional update to avoid stale closures
          set((state) => ({
            ...state,
            currentStreamedText: String(currentText),
          }));

          buffer = "";
          lastRenderTime = now;
        }

        // Wait before adding the next character - dynamic typing speed
        await new Promise((resolve, reject) => {
          // Set up abort handler
          const abortHandler = () => {
            reject(new AbortError("Aborted"));
          };

          // Add abort listener for this promise
          abortController.signal.addEventListener("abort", abortHandler, { once: true });

          // Set timeout for next character
          const timeout = setTimeout(() => {
            abortController.signal.removeEventListener("abort", abortHandler);
            resolve(undefined);
          }, getTypingSpeed(text, i));

          // Also clean up timeout if aborted
          if (abortController.signal.aborted) {
            clearTimeout(timeout);
            abortHandler();
          }
        });
      }

      // Final haptic to signal completion
      if (text.length > 10) {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
          // Ignore haptic errors
        }
      }
    } catch (error) {
      // Handle abortion gracefully
      if (error instanceof AbortError) {
        console.log("TextStreamingStore: Streaming was aborted");
      } else if (error instanceof Error && error.message === "Streaming version changed") {
        console.log("TextStreamingStore: Streaming version changed");
      } else {
        console.error("TextStreamingStore: Error during text streaming:", error);
      }
      return; // Exit early
    } finally {
      // Check if this session is still the current version
      if (get().streamingVersion === currentVersion) {
        // Final state update - use functional update
        set((state) => ({
          ...state,
          isTyping: false,
          abortController: null,
        }));
      }
    }
  },

  resetText: () => {
    // Don't wait for the promise here - just trigger the cancellation
    get().cancelCurrentStreaming();
  },
}));
