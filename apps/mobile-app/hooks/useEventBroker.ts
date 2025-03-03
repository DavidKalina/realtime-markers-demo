// hooks/useEventBroker.ts
import { useEffect, useRef, useCallback } from "react";
import { eventBroker, EventTypes, BaseEvent } from "@/services/EventBroker";

/**
 * Custom hook for interacting with the EventBroker
 */
export function useEventBroker() {
  // Keep track of subscriptions to clean up on unmount
  const subscriptions = useRef<Array<() => void>>([]);

  // Clean up subscriptions when component unmounts
  useEffect(() => {
    return () => {
      subscriptions.current.forEach((unsubscribe) => unsubscribe());
      subscriptions.current = [];
    };
  }, []);

  // Subscribe to an event
  const subscribe = useCallback(
    <T extends BaseEvent>(eventType: EventTypes, callback: (data: T) => void) => {
      const unsubscribe = eventBroker.on<T>(eventType, callback);
      subscriptions.current.push(unsubscribe);
      return unsubscribe;
    },
    []
  );

  // Subscribe to an event once
  const subscribeOnce = useCallback(
    <T extends BaseEvent>(eventType: EventTypes, callback: (data: T) => void) => {
      const unsubscribe = eventBroker.once<T>(eventType, callback);
      subscriptions.current.push(unsubscribe);
      return unsubscribe;
    },
    []
  );

  // Publish an event
  const publish = useCallback(<T extends BaseEvent>(eventType: EventTypes, data: T) => {
    eventBroker.emit(eventType, data);
  }, []);

  return {
    subscribe,
    subscribeOnce,
    publish,
  };
}
