// hooks/useEnhancedTextStreaming.ts
import { useState, useCallback, useRef, useEffect } from "react";
import * as Haptics from "expo-haptics";

/**
 * An enhanced text streaming hook that handles rapid marker transitions
 * with improved cancellation, debouncing, and transition handling.
 */
export const useEnhancedTextStreaming = () => {
  // Core states
  const [currentText, setCurrentText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [queuedStream, setQueuedStream] = useState<{
    messages: string[];
    onComplete?: () => void;
    options?: {
      wordDelayMs?: number;
      messageDelayMs?: number;
      pauseAfterMs?: number;
      characterDelayMs?: number; // New option for character delay
    };
  } | null>(null);

  // Track the current streaming ID to handle multiple requests
  const streamIdRef = useRef<number>(0);

  // Single abort controller for the current streaming operation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track any active timers for cleanup
  const activeTimersRef = useRef<number[]>([]);

  // Track if we're in a transition state (between markers)
  const isTransitioningRef = useRef<boolean>(false);

  // Track the latest marker ID being streamed
  const currentMarkerIdRef = useRef<string | null>(null);

  // Track debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllStreaming();
    };
  }, []);

  /**
   * Clean up all timers
   */
  const clearAllTimers = useCallback(() => {
    // Clear all active timers
    activeTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    activeTimersRef.current = [];

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  /**
   * Complete cleanup of all streaming operations
   */
  const cleanupAllStreaming = useCallback(() => {
    // Abort any controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear all timers
    clearAllTimers();

    // Reset state
    setIsStreaming(false);
    setQueuedStream(null);
    isTransitioningRef.current = false;
  }, [clearAllTimers]);

  /**
   * Cancel any ongoing streaming operation and prepare for a new one
   * @returns true if something was cancelled, false otherwise
   */
  const cancelStreaming = useCallback(() => {
    const hadActiveController = abortControllerRef.current !== null;
    const hadActiveTimers = activeTimersRef.current.length > 0;

    cleanupAllStreaming();

    return hadActiveController || hadActiveTimers;
  }, [cleanupAllStreaming]);

  /**
   * Reset the streaming state
   */
  const resetStreaming = useCallback(() => {
    cancelStreaming();
    setCurrentText("");
    currentMarkerIdRef.current = null;
  }, [cancelStreaming]);

  /**
   * Process the next queued stream if available
   */
  const processQueuedStream = useCallback(() => {
    if (queuedStream) {
      const { messages, onComplete, options } = queuedStream;
      setQueuedStream(null);

      // Small delay to ensure UI is updated before starting new stream
      const timerId = setTimeout(() => {
        _streamMessages(messages, onComplete, options);
      }, 50);

      activeTimersRef.current.push(timerId as unknown as number);
    }
  }, [queuedStream]);

  /**
   * Internal implementation of streamMessages
   */
  const _streamMessages = useCallback(
    async (
      messages: string[],
      onComplete?: () => void,
      options?: {
        wordDelayMs?: number;
        messageDelayMs?: number;
        pauseAfterMs?: number;
        characterDelayMs?: number;
      }
    ) => {
      // Cancel any ongoing streaming
      cancelStreaming();

      // Generate a unique ID for this streaming session
      const streamId = ++streamIdRef.current;

      // No messages to stream
      if (!messages.length) {
        if (onComplete) onComplete();
        return;
      }

      // Configure timing options
      const wordDelay = options?.wordDelayMs ?? 50;
      const messageDelay = options?.messageDelayMs ?? 500;
      const pauseAfter = options?.pauseAfterMs ?? 0;
      const characterDelay = options?.characterDelayMs ?? 5; // Default 30ms between characters

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
          // Check if this streaming session is still current
          if (streamId !== streamIdRef.current || controller.signal.aborted) {
            throw new Error("Streaming superseded by newer stream");
          }

          const message = messages[messageIndex];

          // Always start with empty text for each new message
          setCurrentText("");

          // Process the entire message at once, word by word
          const words = message.split(/\s+/);

          // Process each word
          let displayText = "";
          for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
            // Check if aborted or superseded
            if (streamId !== streamIdRef.current || controller.signal.aborted) {
              throw new Error("Streaming aborted");
            }

            const word = words[wordIndex];

            // Process each character in the word
            for (let charIndex = 0; charIndex < word.length; charIndex++) {
              // Add character to display text
              displayText += word[charIndex];
              setCurrentText(displayText);

              // Light haptic feedback for each character
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {
                // Ignore haptic errors
              }

              // Wait between characters
              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                  resolve();
                }, characterDelay);

                // Add timer to active timers list
                const timerId = timer as unknown as number;
                activeTimersRef.current.push(timerId);

                // Handle abort during wait
                controller.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    activeTimersRef.current = activeTimersRef.current.filter(
                      (id) => id !== timerId
                    );
                    reject(new Error("Streaming aborted during character delay"));
                  },
                  { once: true }
                );
              });
            }

            // Add space between words
            if (wordIndex < words.length - 1) {
              displayText += " ";
              setCurrentText(displayText);
            }

            // Wait between words
            if (wordIndex < words.length - 1) {
              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                  resolve();
                }, wordDelay);

                // Add timer to active timers list
                const timerId = timer as unknown as number;
                activeTimersRef.current.push(timerId);

                // Handle abort during wait
                controller.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    activeTimersRef.current = activeTimersRef.current.filter(
                      (id) => id !== timerId
                    );
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

              // Add timer to active timers list
              const timerId = timer as unknown as number;
              activeTimersRef.current.push(timerId);

              // Handle abort during wait
              controller.signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  activeTimersRef.current = activeTimersRef.current.filter((id) => id !== timerId);
                  reject(new Error("Streaming aborted during message delay"));
                },
                { once: true }
              );
            });
          }
        }

        // Final haptic feedback
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {
          // Ignore haptic errors
        }

        // Streaming text animation completed
        if (streamId === streamIdRef.current) {
          // Keep isStreaming true during the pause
          // but mark that we're no longer in transition
          isTransitioningRef.current = false;

          // Add a pause after streaming completes to give user time to read
          // Only start pause if we're still the current stream and not aborted
          if (streamId === streamIdRef.current && !controller.signal.aborted) {
            try {
              await new Promise<void>((resolve, reject) => {
                // Create a timeout for the pause
                const timer = setTimeout(() => {
                  resolve();
                }, pauseAfter);

                // Add timer to active timers list
                const timerId = timer as unknown as number;
                activeTimersRef.current.push(timerId);

                // Handle abort during wait
                controller.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    activeTimersRef.current = activeTimersRef.current.filter(
                      (id) => id !== timerId
                    );
                    reject(new Error("Streaming aborted during pause after"));
                  },
                  { once: true }
                );
              });
            } catch (error) {
              // If aborted during pause, break out of the function early
              if (streamId === streamIdRef.current) {
                setIsStreaming(false);
                abortControllerRef.current = null;
              }
              return; // Exit early - don't call onComplete
            }
          }

          // Finally mark streaming as complete
          setIsStreaming(false);
          abortControllerRef.current = null;

          // Call completion callback if provided
          if (onComplete) onComplete();

          // Process any queued streams
          processQueuedStream();
        }
      } catch (error) {
        // Streaming was cancelled or failed

        if (streamId === streamIdRef.current) {
          setIsStreaming(false);
          abortControllerRef.current = null;

          // Process any queued streams if this was the current stream
          processQueuedStream();
        }
      }
    },
    [cancelStreaming, processQueuedStream]
  );

  /**
   * Stream messages with debouncing to handle rapid marker changes
   */
  const streamMessages = useCallback(
    (
      messages: string[],
      onComplete?: () => void,
      options?: {
        wordDelayMs?: number;
        messageDelayMs?: number;
        pauseAfterMs?: number;
        characterDelayMs?: number;
        markerId?: string;
        debounceMs?: number;
      }
    ) => {
      const markerId = options?.markerId;
      const debounceTime = options?.debounceMs ?? 300; // Default debounce time

      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // If the marker ID changes, indicate we're transitioning
      if (markerId && markerId !== currentMarkerIdRef.current) {
        isTransitioningRef.current = true;
        currentMarkerIdRef.current = markerId;
      }

      // If we're already streaming, queue this stream for later
      if (isStreaming && !isTransitioningRef.current) {
        setQueuedStream({
          messages,
          onComplete,
          options,
        });
        return;
      }

      // Use debouncing to avoid rapid switching
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        _streamMessages(messages, onComplete, options);
      }, debounceTime);
    },
    [isStreaming, _streamMessages]
  );

  /**
   * Stream a message sequence immediately for a specific marker
   * This takes precedence over any existing streams or queues
   */
  const streamForMarker = useCallback(
    (
      markerId: string,
      messages: string[],
      onComplete?: () => void,
      options?: {
        wordDelayMs?: number;
        messageDelayMs?: number;
        pauseAfterMs?: number;
        characterDelayMs?: number;
      }
    ) => {
      // Cancel all existing streams
      cancelStreaming();

      // Update marker ID
      currentMarkerIdRef.current = markerId;

      // Remove any queued streams
      setQueuedStream(null);

      // Stream immediately without debouncing
      _streamMessages(messages, onComplete, options);
    },
    [cancelStreaming, _streamMessages]
  );

  /**
   * Stream a single message immediately without animation
   * but with optional pause after
   */
  const streamImmediate = useCallback(
    (message: string, onComplete?: () => void, pauseAfterMs?: number) => {
      // Cancel any existing streams
      cancelStreaming();

      // Set the message immediately
      setCurrentText(message);
      setIsStreaming(true);

      // Default pause of 2000ms if not specified
      const pauseAfter = pauseAfterMs ?? 2000;

      // Create a new abort controller for this immediate stream
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Generate a unique ID for this streaming session
      const streamId = ++streamIdRef.current;

      // Add a pause before completing
      const timerId = setTimeout(() => {
        // Only proceed if this is still the current stream and not aborted
        if (streamId === streamIdRef.current && !controller.signal.aborted) {
          setIsStreaming(false);
          abortControllerRef.current = null;
          if (onComplete) onComplete();
        }
      }, pauseAfter) as unknown as number;

      // Store the timer ID for cleanup
      activeTimersRef.current.push(timerId as unknown as number);

      // Set up abort handling for this timer
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timerId);
          activeTimersRef.current = activeTimersRef.current.filter((id) => id !== timerId);

          // Reset streaming state if this is still the current stream
          if (streamId === streamIdRef.current) {
            setIsStreaming(false);
            abortControllerRef.current = null;
          }
        },
        { once: true }
      );
    },
    [cancelStreaming]
  );

  return {
    currentText,
    isStreaming,
    streamMessages,
    streamForMarker,
    streamImmediate,
    cancelStreaming,
    resetStreaming,
    isTransitioning: isTransitioningRef.current,
    currentMarkerId: currentMarkerIdRef.current,
  };
};
