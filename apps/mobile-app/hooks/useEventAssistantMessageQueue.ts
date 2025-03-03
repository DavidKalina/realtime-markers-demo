// hooks/useMessageQueue.ts - Final optimized version
import { useState, useEffect, useCallback, useRef } from "react";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import { getMessageEmoji } from "../utils/messageUtils";

// Message queue state interface
interface MessageQueueState {
  messages: string[];
  version: number;
  processing: boolean;
  markerId: string | null;
}

/**
 * Custom hook to manage message queue for the assistant
 */
export const useMessageQueue = () => {
  // Text streaming store
  const textStreamingStore = useTextStreamingStore();

  // Get values from store - extract only what we need to minimize re-renders
  const currentStreamedText = textStreamingStore.currentStreamedText;
  const isTyping = textStreamingStore.isTyping;

  // Store functions in refs to prevent them from causing re-renders when dependencies change
  const storeActionsRef = useRef({
    simulateTextStreaming: textStreamingStore.simulateTextStreaming,
    setCurrentEmoji: textStreamingStore.setCurrentEmoji,
    cancelCurrentStreaming: textStreamingStore.cancelCurrentStreaming,
  });

  // Update refs when functions change
  useEffect(() => {
    storeActionsRef.current = {
      simulateTextStreaming: textStreamingStore.simulateTextStreaming,
      setCurrentEmoji: textStreamingStore.setCurrentEmoji,
      cancelCurrentStreaming: textStreamingStore.cancelCurrentStreaming,
    };
  }, [
    textStreamingStore.simulateTextStreaming,
    textStreamingStore.setCurrentEmoji,
    textStreamingStore.cancelCurrentStreaming,
  ]);

  // Message queue state
  const [messageQueueState, setMessageQueueState] = useState<MessageQueueState>({
    messages: [],
    version: 0,
    processing: false,
    markerId: null,
  });

  // Refs for current state to avoid stale closures in async functions
  const messageQueueRef = useRef(messageQueueState);

  // Update ref whenever state changes
  useEffect(() => {
    messageQueueRef.current = messageQueueState;
  }, [messageQueueState]);

  const clearMessagesImmediate = useCallback(() => {
    // Cancel any ongoing streaming without waiting
    storeActionsRef.current.cancelCurrentStreaming();

    // Update queue state with new version immediately
    setMessageQueueState((prevState) => ({
      messages: [],
      version: prevState.version + 1,
      processing: false,
      markerId: null,
    }));

    // Reset emoji
    storeActionsRef.current.setCurrentEmoji("");

    // No waiting, return immediately
    return Promise.resolve();
  }, []);

  /**
   * Clear and reset messaging state
   */
  const clearMessageQueue = useCallback(async () => {
    try {
      // Cancel any ongoing streaming first and wait for it to complete
      await storeActionsRef.current.cancelCurrentStreaming();

      // Update queue state with new version
      setMessageQueueState((prevState) => ({
        messages: [],
        version: prevState.version + 1,
        processing: false,
        markerId: null,
      }));

      // Reset emoji
      storeActionsRef.current.setCurrentEmoji("");
    } catch (error) {
      console.error("Error clearing message queue:", error);
    }
  }, []);

  /**
   * Set new messages in the queue
   */
  const setNewMessages = useCallback((messages: string[], markerId: string | null = null) => {
    if (!messages || messages.length === 0) return;

    // Use functional update to compare with previous state
    setMessageQueueState((prevState) => {
      // Skip update if identical content
      if (
        prevState.markerId === markerId &&
        JSON.stringify(prevState.messages) === JSON.stringify(messages)
      ) {
        return prevState;
      }

      return {
        messages: [...messages],
        version: prevState.version + 1,
        processing: false,
        markerId,
      };
    });
  }, []);

  // Process the message queue using requestAnimationFrame for better performance
  useEffect(() => {
    let frameId: number | null = null;
    let isProcessing = false;

    const processQueue = async () => {
      // Skip if already processing
      if (isProcessing) {
        scheduleNextFrame();
        return;
      }

      const queueState = messageQueueRef.current;

      // Skip if queue is empty or already marked as processing
      if (queueState.messages.length === 0 || queueState.processing) {
        scheduleNextFrame();
        return;
      }

      try {
        // Mark as processing
        isProcessing = true;
        setMessageQueueState((prev) => ({ ...prev, processing: true }));

        // Get the first message
        const message = queueState.messages[0];
        const markerId = queueState.markerId;
        const version = queueState.version;

        // Set emoji
        const emoji = getMessageEmoji(message, markerId);
        storeActionsRef.current.setCurrentEmoji(emoji);

        // Process the message
        await storeActionsRef.current.simulateTextStreaming(message);

        // Check if version still matches
        if (messageQueueRef.current.version !== version) {
          console.log("Message queue version changed during processing");
          isProcessing = false;
          scheduleNextFrame();
          return;
        }

        // Remove the processed message
        setMessageQueueState((prev) => {
          if (prev.version !== version) return prev;

          return {
            ...prev,
            messages: prev.messages.slice(1),
            processing: false,
          };
        });

        // Add a delay between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Error processing message queue:", error);
      } finally {
        isProcessing = false;
        scheduleNextFrame();
      }
    };

    const scheduleNextFrame = () => {
      frameId = requestAnimationFrame(() => {
        frameId = null;
        processQueue();
      });
    };

    // Start processing
    scheduleNextFrame();

    // Cleanup
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  // Return stable interface
  return {
    currentText: currentStreamedText,
    isTyping,
    queueMessages: setNewMessages,
    clearMessages: clearMessageQueue,
    clearMessagesImmediate, // Add new immediate version
    isEmpty: messageQueueState.messages.length === 0 && !isTyping,
    currentMarkerId: messageQueueState.markerId,
  };
};
