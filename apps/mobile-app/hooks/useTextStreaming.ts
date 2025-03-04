// hooks/useTextStreaming.ts
import { useState, useCallback, useRef } from "react";
import * as Haptics from "expo-haptics";

// Custom AbortError class since DOMException isn't available in React Native
class AbortError extends Error {
  name: string;
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

export const useTextStreaming = () => {
  // Local state for text streaming
  const [currentStreamedText, setCurrentStreamedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentEmoji, setCurrentEmoji] = useState("");
  const [lastStreamedText, setLastStreamedText] = useState("");
  const [streamCount, setStreamCount] = useState(0);
  const [streamingVersion, setStreamingVersion] = useState(0);

  // Ref to hold the current AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelCurrentStreaming = useCallback(async () => {
    console.log("Cancelling streaming - version:", streamingVersion);
    if (abortControllerRef.current) {
      console.log("Aborting controller explicitly");
      abortControllerRef.current.abort();
    }
    // Increment the version so that any in-progress streaming recognizes the change
    setStreamingVersion((prev) => prev + 1);
    setIsTyping(false);
    setCurrentStreamedText("");
    abortControllerRef.current = null;
    // Optionally reset the emoji
    setCurrentEmoji("");
    return Promise.resolve();
  }, [streamingVersion]);

  const simulateTextStreaming = useCallback(
    async (text: string) => {
      if (!text || text.length === 0) return;

      // Cancel any ongoing streaming before starting
      await cancelCurrentStreaming();

      // Capture the current version for this streaming session
      const currentVersion = streamingVersion;
      const newAbortController = new AbortController();
      abortControllerRef.current = newAbortController;

      // Initialize streaming state
      setIsTyping(true);
      setCurrentStreamedText("");
      setLastStreamedText(text);
      setStreamCount((prev) => prev + 1);

      // Provide initial haptic feedback
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Ignore haptic errors
      }

      let currentText = "";
      let lastRenderTime = Date.now();
      const minRenderInterval = 16; // ~60fps

      // Function to compute typing speed
      const getTypingSpeed = (message: string, index: number) => {
        if (index < 5) return 15;
        if (/\p{Emoji}/u.test(message[index])) return 10;
        if ([".", ",", "!", "?", ";", ":"].includes(message[index])) return 40;
        const baseSpeed = message.length < 30 ? 18 : message.length < 60 ? 22 : 25;
        return baseSpeed + Math.floor(Math.random() * 8) - 4;
      };

      let lastHapticTime = 0;
      const hapticInterval = 300; // Reduced frequency for smoother experience

      try {
        for (let i = 0; i < text.length; i++) {
          // Check if streaming was aborted
          if (newAbortController.signal.aborted) {
            throw new AbortError("Aborted");
          }
          // Ensure this streaming session is still current
          if (streamingVersion !== currentVersion) {
            throw new Error("Streaming version changed");
          }

          currentText += text[i];

          const now = Date.now();
          // Trigger periodic haptic feedback for longer texts
          if (text.length > 50 && now - lastHapticTime >= hapticInterval && i % 15 === 0) {
            try {
              await Haptics.selectionAsync();
              lastHapticTime = now;
            } catch (e) {
              // Ignore haptic errors
            }
          }

          // Update state only at controlled intervals to reduce flickering
          if (now - lastRenderTime >= minRenderInterval || i === text.length - 1) {
            if (newAbortController.signal.aborted || streamingVersion !== currentVersion) {
              throw new AbortError("Aborted");
            }
            setCurrentStreamedText(String(currentText));
            lastRenderTime = now;
          }

          // Wait before adding the next character using a dynamic delay
          await new Promise<void>((resolve, reject) => {
            const abortHandler = () => {
              clearTimeout(timeout);
              reject(new AbortError("Aborted during character typing"));
            };
            newAbortController.signal.addEventListener("abort", abortHandler);
            const timeout = setTimeout(() => {
              newAbortController.signal.removeEventListener("abort", abortHandler);
              resolve();
            }, getTypingSpeed(text, i));
          });
        }

        // Final haptic feedback to signal completion
        if (text.length > 10) {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (e) {
            // Ignore haptic errors
          }
        }
      } catch (error) {
        if (error instanceof AbortError) {
          console.log("TextStreaming: Streaming was aborted", {
            message: error.message,
            streamingVersion,
            currentVersion,
            isTyping,
          });
        } else if (error instanceof Error && error.message === "Streaming version changed") {
          console.log("TextStreaming: Streaming version changed");
        } else {
          console.error("TextStreaming: Error during text streaming:", error);
        }
        return; // Exit early on error
      } finally {
        // If still the current session, finalize state
        if (streamingVersion === currentVersion) {
          setIsTyping(false);
          abortControllerRef.current = null;
        }
      }
    },
    [cancelCurrentStreaming, streamingVersion]
  );

  const resetText = useCallback(() => {
    cancelCurrentStreaming();
  }, [cancelCurrentStreaming]);

  return {
    currentStreamedText,
    isTyping,
    currentEmoji,
    lastStreamedText,
    streamCount,
    streamingVersion,
    simulateTextStreaming,
    setCurrentEmoji,
    resetText,
    cancelCurrentStreaming,
  };
};
