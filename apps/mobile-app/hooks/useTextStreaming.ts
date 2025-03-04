// hooks/useSimplifiedTextStreaming.ts
import { useState, useCallback, useRef, useEffect } from "react";
import * as Haptics from "expo-haptics";

/**
 * A simplified text streaming hook that uses word-by-word streaming
 * rather than character-by-character for better performance and easier management.
 * Each message completely replaces the previous one.
 */
export const useSimplifiedTextStreaming = () => {
  // Core states
  const [currentText, setCurrentText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Single abort controller for the current streaming operation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  /**
   * Cancel any ongoing streaming operation
   */
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /**
   * Reset the streaming state
   */
  const resetStreaming = useCallback(() => {
    cancelStreaming();
    setCurrentText("");
  }, [cancelStreaming]);

  /**
   * Stream a series of messages word-by-word with a callback on completion.
   * Each message completely replaces the previous one.
   */
  const streamMessages = useCallback(
    async (
      messages: string[],
      onComplete?: () => void,
      options?: {
        wordDelayMs?: number;
        messageDelayMs?: number;
      }
    ) => {
      // Cancel any ongoing streaming
      cancelStreaming();

      // Reset the current text
      setCurrentText("");

      // No messages to stream
      if (!messages.length) {
        if (onComplete) onComplete();
        return;
      }

      // Configure timing options
      const wordDelay = options?.wordDelayMs ?? 100; // 100ms between words
      const messageDelay = options?.messageDelayMs ?? 1000; // 1000ms between messages

      // Create a new abort controller for this streaming session
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Start streaming
      setIsStreaming(true);

      try {
        // Initial haptic feedback
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
          // Ignore haptic errors
        }

        // Process each message in sequence
        for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
          const message = messages[messageIndex];

          // Always start with empty text for each new message
          setCurrentText("");

          // Process the entire message at once, word by word
          const words = message.split(/\s+/);

          // Process each word
          let displayText = "";
          for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
            // Check if aborted
            if (controller.signal.aborted) {
              throw new Error("Streaming aborted");
            }

            const word = words[wordIndex];

            // Add word to display text
            displayText += (wordIndex > 0 ? " " : "") + word;

            // Update text display - only show the current message being streamed
            setCurrentText(displayText);

            // Wait between words
            if (wordIndex < words.length - 1) {
              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                  resolve();
                }, wordDelay);

                // Handle abort during wait
                controller.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    reject(new Error("Streaming aborted during word delay"));
                  },
                  { once: true }
                );
              });
            }
          }

          // Wait between messages
          if (messageIndex < messages.length - 1) {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                resolve();
              }, messageDelay);

              // Handle abort during wait
              controller.signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  reject(new Error("Streaming aborted during message delay"));
                },
                { once: true }
              );
            });
          }
        }

        // Final haptic feedback
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
          // Ignore haptic errors
        }

        // Streaming completed successfully
        setIsStreaming(false);
        abortControllerRef.current = null;

        // Call completion callback if provided
        if (onComplete) onComplete();
      } catch (error) {
        // Streaming was cancelled or failed
        console.log("Streaming cancelled:", error);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [cancelStreaming]
  );

  /**
   * Stream a single message immediately without animation
   */
  const streamImmediate = useCallback(
    (message: string, onComplete?: () => void) => {
      cancelStreaming();
      setCurrentText(message);

      if (onComplete) {
        // Small delay to ensure UI updates before callback
        setTimeout(onComplete, 50);
      }
    },
    [cancelStreaming]
  );

  return {
    currentText,
    isStreaming,
    streamMessages,
    streamImmediate,
    cancelStreaming,
    resetStreaming,
  };
};
