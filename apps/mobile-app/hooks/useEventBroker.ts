// hooks/useEventBroker.ts — React hook wrapper around the EventBroker singleton.
import { useCallback } from "react";
import { eventBroker, type BaseEvent } from "@/services/EventBroker";

export function useEventBroker() {
  const publish = useCallback(
    <T extends BaseEvent>(eventType: string, data: Omit<T, "timestamp" | "source"> & { timestamp: number; source: string }) => {
      eventBroker.emit(eventType, data as T);
    },
    [],
  );

  const subscribe = useCallback(
    <T extends BaseEvent = BaseEvent>(
      eventType: string,
      listener: (data: T) => void,
    ): (() => void) => {
      return eventBroker.on<T>(eventType, listener);
    },
    [],
  );

  return { publish, subscribe };
}
