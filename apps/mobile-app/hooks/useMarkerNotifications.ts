// hooks/useMarkerNotifications.ts
import { useEffect, useRef, useState } from "react";
import { useMapWebSocket } from "./useMapWebsocket";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";

/**
 * Custom hook that listens for new markers from WebSocket and triggers assistant notifications
 */
export const useMarkerNotifications = () => {
  const { markers, currentViewport } = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);

  const {
    setTransitionMessage,
    setMessageIndex,
    setShowActions,
    activeView,
    messageIndex,
    setCurrentEvent,
    setEventList,
    hasEvents,
  } = useEventAssistantStore();

  const { simulateTextStreaming, isTyping } = useTextStreamingStore();

  // Track if we've seen specific regions
  const [notifiedRegions, setNotifiedRegions] = useState<Set<string>>(new Set());

  // Track previous marker count
  const prevMarkerCount = useRef(0);

  // Track last notification time
  const lastNotificationTime = useRef(0);

  // Flag to force a notification
  const [forceNotify, setForceNotify] = useState(false);

  // Track if we've shown the initial empty state message
  const [hasShownEmptyState, setHasShownEmptyState] = useState(false);

  // Track if we need to show initial guidance
  const [hasShownGuidance, setHasShownGuidance] = useState(false);

  // Create a region key from viewport
  const getRegionKey = (viewport: any) => {
    if (!viewport) return "";
    // Round to 2 decimal places for a reasonable geofence size
    const lat = Math.round(((viewport.north + viewport.south) / 2) * 100) / 100;
    const lng = Math.round(((viewport.east + viewport.west) / 2) * 100) / 100;
    return `${lat},${lng}`;
  };

  // Force a notification - can be called externally
  const triggerNotification = () => {
    setForceNotify(true);
  };

  // Initial guidance to explain how to use the app
  useEffect(() => {
    if (hasShownGuidance || isTyping || activeView) return;

    // Wait 1.5 seconds after initial load to show guidance
    const timer = setTimeout(() => {
      console.log("🚀 Showing initial guidance");
      setMessageIndex(0);
      setShowActions(false);

      // First welcome message
      simulateTextStreaming("Welcome to EventExplorer! I'm your event assistant.").then(() => {
        setTimeout(() => {
          // Second message explaining capabilities
          simulateTextStreaming(
            "I can help you find events nearby. Try moving the map to discover events in different areas."
          ).then(() => {
            setTimeout(() => {
              // Third message with instruction
              simulateTextStreaming(
                "When you find events, you can navigate between them using the arrows at the bottom of the screen."
              ).then(() => {
                setTimeout(() => {
                  setShowActions(true);
                }, 1000);
              });
            }, 2000);
          });
        }, 2000);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasShownGuidance, isTyping, activeView]);

  useEffect(() => {
    // Update event list whenever markers change
    if (markers && Array.isArray(markers) && markers.length > 0) {
      // Convert markers to event format with exact same properties as before
      const events = markers.map((marker) => ({
        emoji: marker.data?.emoji || "📍",
        title: marker.data?.title || "Unnamed Event",
        description: marker.data?.description || "Join us for this exciting event!",
        location: marker.data?.location || "See map for location",
        time: marker.data?.time || new Date().toLocaleString(),
        distance: marker.data?.distance || "See map for location",
        categories: Array.isArray(marker.data?.categories)
          ? marker.data.categories
          : [marker.data?.color || "Event"],
      }));

      // Update the event list in the store
      if (typeof setEventList === "function") {
        setEventList(events);
      }
    }

    // Don't do anything if we're in a modal view
    if (activeView) return;

    // Don't interrupt if currently typing, wait for it to finish
    if (isTyping) return;

    // If we have no markers and haven't shown empty state, show it once
    if ((!markers || markers.length === 0) && !hasShownEmptyState && hasShownGuidance) {
      console.log("🏜️ Showing empty state message");
      setHasShownEmptyState(true);
      setMessageIndex(0);
      setShowActions(false);

      simulateTextStreaming(
        "I don't see any events in this area yet. Try exploring the map or zoom out to find more events."
      ).then(() => {
        setTimeout(() => setShowActions(true), 1000);
      });

      return;
    }

    // Only act if we have markers and viewport
    if (!markers || !Array.isArray(markers) || markers.length === 0 || !currentViewport) {
      return;
    }

    console.log("🔍 MARKER CHECK:", {
      markerCount: markers.length,
      prevCount: prevMarkerCount.current,
      region: getRegionKey(currentViewport),
    });

    const regionKey = getRegionKey(currentViewport);
    const currentTime = Date.now();
    const markerCountChanged = prevMarkerCount.current !== markers.length;
    const isNewRegion = !notifiedRegions.has(regionKey);
    const timeSinceLastNotification = currentTime - lastNotificationTime.current;
    const cooldownPassed = timeSinceLastNotification > 10000; // 10 seconds cooldown

    // Check if we should notify
    if (forceNotify || (markerCountChanged && cooldownPassed) || isNewRegion) {
      console.log("🔔 MARKER NOTIFICATION TRIGGERED:", {
        markerCount: markers.length,
        forceNotify,
        markerCountChanged,
        isNewRegion,
        timeSinceLastNotification,
      });

      // Update tracking state
      lastNotificationTime.current = currentTime;
      prevMarkerCount.current = markers.length;
      setNotifiedRegions((prev) => {
        const updated = new Set(prev);
        updated.add(regionKey);
        return updated;
      });
      setForceNotify(false);

      // If we have events, set the current event to the first marker
      if (markers.length > 0) {
        const firstMarker = markers[0];
        // Send to event assistant store
        if (typeof setCurrentEvent === "function") {
          console.log("🎯 Setting current event from marker:", firstMarker.id);
          setCurrentEvent({
            emoji: firstMarker.data?.emoji || "📍",
            title: firstMarker.data?.title || "Unnamed Event",
            description: firstMarker.data?.description || "Join us for this exciting event!",
            location: firstMarker.data?.location || "See map for location",
            time: firstMarker.data?.time || new Date().toLocaleString(),
            distance: firstMarker.data?.distance || "See map for location",
            categories: Array.isArray(firstMarker.data?.categories)
              ? firstMarker.data.categories
              : [firstMarker.data?.color || "Event"],
          });
        }
      }

      // Reset message index to start new sequence
      if (typeof setMessageIndex === "function") {
        console.log("🔄 Resetting message index and hiding actions");
        setMessageIndex(0);
      }

      if (typeof setShowActions === "function") {
        setShowActions(false);
      }

      // Create notification message - improved with more specific details
      let message = "";
      if (markers.length === 1) {
        const marker = markers[0];
        message = `I found an event nearby! ${marker.data?.emoji || "📍"} ${
          marker.data?.title || "Check it out."
        }`;
      } else {
        message = `I found ${markers.length} events in this area! Use the arrows to explore them.`;
      }

      // Use transition message for immediate feedback
      if (typeof setTransitionMessage === "function") {
        console.log("💬 Setting transition message:", message);
        setTransitionMessage(message);

        // Clear transition message after showing it briefly
        setTimeout(() => {
          setTransitionMessage(null);

          // Stream the full message after transition
          console.log("🔊 Streaming full message");
          if (typeof simulateTextStreaming === "function") {
            simulateTextStreaming(message)
              .then(() => {
                // Show actions after message completes
                setTimeout(() => {
                  if (typeof setShowActions === "function") {
                    console.log("👆 Showing actions");
                    setShowActions(true);
                  }
                }, 500);
              })
              .catch((e) => console.error("Error streaming:", e));
          }
        }, 1200);
      } else {
        // Fallback if transition message isn't available
        console.log("⚠️ setTransitionMessage not available, trying direct streaming");
        if (typeof simulateTextStreaming === "function") {
          simulateTextStreaming(message)
            .then(() => {
              setTimeout(() => {
                if (typeof setShowActions === "function") {
                  setShowActions(true);
                }
              }, 500);
            })
            .catch((e) => console.error("Error streaming:", e));
        }
      }
    }
  }, [
    markers,
    currentViewport,
    activeView,
    isTyping,
    forceNotify,
    messageIndex,
    hasShownEmptyState,
    hasShownGuidance,
  ]);

  return {
    markerCount: markers?.length || 0,
    triggerNotification,
    currentRegion: currentViewport ? getRegionKey(currentViewport) : null,
    hasEvents: markers?.length > 0,
  };
};
