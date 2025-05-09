import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, NotificationEvent } from "@/services/EventBroker";
import { useEffect } from "react";

interface SimulatedNotification {
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
  delay: number;
}

interface SimulatedDiscovery {
  id: string;
  emoji: string;
  coordinates: [number, number];
}

interface UseSimulatedNotificationsProps {
  notifications?: SimulatedNotification[];
  discovery?: SimulatedDiscovery;
  enabled?: boolean;
}

const DEFAULT_NOTIFICATIONS: SimulatedNotification[] = [
  {
    title: "Welcome!",
    message: "You're now connected to the network",
    type: "success",
    delay: 1000,
  },
  {
    title: "New Event Nearby",
    message: "A new event has been discovered in your area",
    type: "info",
    delay: 3000,
  },
  {
    title: "Location Services",
    message: "Please enable location services for better experience",
    type: "warning",
    delay: 5000,
  },
  {
    title: "Connection Error",
    message: "Unable to connect to the server",
    type: "error",
    delay: 7000,
  },
];

const DEFAULT_DISCOVERY: SimulatedDiscovery = {
  id: "test-discovery-1",
  emoji: "🎉",
  coordinates: [0, 0],
};

export const useSimulatedNotifications = ({
  notifications = DEFAULT_NOTIFICATIONS,
  discovery = DEFAULT_DISCOVERY,
  enabled = false,
}: UseSimulatedNotificationsProps = {}) => {
  const { publish } = useEventBroker();

  useEffect(() => {
    if (!enabled) return;

    // Schedule notifications
    const timeouts = notifications.map((notification) => {
      return setTimeout(() => {
        publish<NotificationEvent>(EventTypes.NOTIFICATION, {
          title: notification.title,
          message: notification.message,
          notificationType: notification.type,
          duration: 5000,
          timestamp: Date.now(),
          source: "test",
        });
      }, notification.delay);
    });

    // Schedule discovery event
    const discoveryTimeout = setTimeout(() => {
      publish(EventTypes.EVENT_DISCOVERED, {
        event: {
          id: discovery.id,
          emoji: discovery.emoji,
          location: {
            coordinates: discovery.coordinates,
          },
        },
        timestamp: Date.now(),
        source: "test",
      });
    }, 2000);

    // Cleanup timeouts
    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(discoveryTimeout);
    };
  }, [publish, notifications, discovery, enabled]);
};
