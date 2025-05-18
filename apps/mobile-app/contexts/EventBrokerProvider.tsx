// components/EventBrokerProvider.tsx
import React, { useEffect } from "react";
import { eventBroker, EventTypes, BaseEvent } from "@/services/EventBroker";

/**
 * EventBrokerProvider initializes the event broker system and sets up global event listeners.
 * Use this component near the root of your application.
 */
export const EventBrokerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    // Set up global event listeners or initialize other event-related services here

    // Example of a global error handler for events
    const unsubscribe = eventBroker.on<BaseEvent & { error: Error | string }>(
      EventTypes.ERROR_OCCURRED,
      (eventData) => {
        // Log errors from any event component
        console.error(
          `[EventError] ${eventData.source || "unknown"}: `,
          eventData.error,
        );
      },
    );

    // Clean up event listeners when the app is unmounted
    return () => {
      unsubscribe();
    };
  }, []);

  return <>{children}</>;
};

/**
 * Utility function to initialize the event broker outside of React components
 * (e.g., in service workers or non-component contexts)
 */
export function initializeEventBroker() {
  // Set up any global configuration for the event broker
  eventBroker.setDebugMode(__DEV__);

  // Return the broker instance for convenience
  return eventBroker;
}
