import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventCacheStore } from "@/stores/useEventCacheStore";
import { apiClient } from "@/services/ApiClient";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Linking, Alert, Platform } from "react-native";
import { calculateDistance, formatDistance } from "@/utils/distanceUtils";
import * as Haptics from "expo-haptics";
import { formatDate } from "@/utils/dateTimeFormatting";
import { EventType } from "@/types/types";
import useEventAnalytics from "@/hooks/useEventAnalytics";

export const useEventDetails = (eventId: string, onBack?: () => void) => {
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [savingState, setSavingState] = useState<"idle" | "loading">("idle");
  const [isRsvped, setIsRsvped] = useState(false);
  const [rsvpState, setRsvpState] = useState<"idle" | "loading">("idle");
  const router = useRouter();
  const { getCachedEvent, setCachedEvent } = useEventCacheStore();
  const eventAnalytics = useEventAnalytics();

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { userLocation, isLoadingLocation } = useUserLocation();
  const [distanceInfo, setDistanceInfo] = useState<string | null>(null);

  // Fetch event details when eventId changes
  useEffect(() => {
    let isMounted = true;

    const fetchEventDetails = async () => {
      if (!eventId) return;

      setLoading(true);
      setError(null);

      try {
        // First check the cache
        const cachedEvent = getCachedEvent(eventId);
        if (cachedEvent) {
          if (isMounted) {
            setEvent(cachedEvent);
            if (cachedEvent.saveCount !== undefined) {
              setSaveCount(cachedEvent.saveCount);
            }
            // If we have cached event, still check RSVP status if authenticated
            if (apiClient.isAuthenticated()) {
              try {
                const { isRsvped: rsvpStatus } =
                  await apiClient.rsvp.isEventRsvped(eventId);
                if (isMounted) {
                  setIsRsvped(rsvpStatus);
                }
              } catch (rsvpErr) {
                console.error("Error checking RSVP status:", rsvpErr);
              }
            }
          }
          setLoading(false);
          return;
        }

        // If not in cache, fetch from API
        const [eventData, rsvpStatus, saveStatus] = await Promise.all([
          apiClient.events.getEventById(eventId),
          apiClient.isAuthenticated()
            ? apiClient.rsvp.isEventRsvped(eventId)
            : Promise.resolve({ isRsvped: false }),
          apiClient.isAuthenticated()
            ? apiClient.events.isEventSaved(eventId)
            : Promise.resolve({ isSaved: false }),
        ]);

        if (isMounted) {
          setEvent(eventData);
          setIsRsvped(rsvpStatus.isRsvped);
          setIsSaved(saveStatus.isSaved);
          if (eventData.saveCount !== undefined) {
            setSaveCount(eventData.saveCount);
          }
          // Cache the event data
          setCachedEvent(eventId, eventData);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
          console.error("Error fetching event details:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEventDetails();

    return () => {
      isMounted = false;
    };
  }, [eventId, getCachedEvent, setCachedEvent]);

  // Track event view when event is loaded
  useEffect(() => {
    if (event) {
      eventAnalytics.trackEventView(event);
    }
  }, [event, eventAnalytics]);

  // Update distance whenever user location or event coordinates change
  useEffect(() => {
    if (!event || !event.coordinates || !userLocation) {
      setDistanceInfo(null);
      return;
    }

    const distance = calculateDistance(userLocation, event.coordinates);
    setDistanceInfo(formatDistance(distance));
  }, [event, userLocation]);

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Retry fetching event details
  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEvent(null);
    setError(null);
    setLoading(true);
    apiClient.events
      .getEventById(eventId)
      .then((data) => setEvent(data))
      .catch((err) =>
        setError(
          `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`,
        ),
      )
      .finally(() => setLoading(false));
  };

  // Handle save/unsave toggle
  const handleToggleSave = async () => {
    if (!event || !apiClient.isAuthenticated()) return;

    setSavingState("loading");
    try {
      const newSavedState = !isSaved;
      await apiClient.events.toggleSaveEvent(event.id!);
      setIsSaved(newSavedState);

      // Update save count
      const newSaveCount = newSavedState ? saveCount + 1 : saveCount - 1;
      setSaveCount(newSaveCount);

      // Update cached event
      if (event) {
        const updatedEvent = { ...event, saveCount: newSaveCount };
        setCachedEvent(event.id!, updatedEvent);
      }

      // Track the save action
      eventAnalytics.trackEventSave(event, newSavedState ? "save" : "unsave");

      // Provide haptic feedback
      Haptics.notificationAsync(
        newSavedState
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    } catch (err) {
      console.error("Error toggling save status:", err);
      Alert.alert("Error", "Failed to save event. Please try again.");
    } finally {
      setSavingState("idle");
    }
  };

  const handleShare = async () => {
    if (!event) return;

    try {
      // Track the share action
      eventAnalytics.trackEventShare(event, "native_share");

      // Create a shareable message
      const message = `${event.title}\n\n📅 ${formatDate(
        event.eventDate instanceof Date
          ? event.eventDate.toISOString()
          : event.eventDate,
        event.timezone,
      )}\n📍 ${event.location}\n\n${event.description || ""}`;

      // Create a deep link (if your app supports it)
      const deepLink = `eventexplorer://event/${eventId}`;

      // Combine message and deeplink
      const fullMessage = message + "\n\n" + deepLink;

      // Open SMS with the message pre-filled
      const url = `sms:&body=${encodeURIComponent(fullMessage)}`;

      // Check if we can open the URL
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error("Error sharing event:", err);
      Alert.alert("Sharing Failed", "There was a problem sharing this event.");
    }
  };

  // Open the location in the native maps app
  const handleOpenMaps = () => {
    if (!event || !event.coordinates) return;

    try {
      // Track the map open action
      eventAnalytics.trackMapOpen(event);

      const [longitude, latitude] = event.coordinates;
      const url = Platform.select({
        ios: `maps:?q=${latitude},${longitude}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
      });

      if (url) {
        Linking.openURL(url);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error("Error opening maps:", err);
    }
  };

  // Handle get directions (uses turn-by-turn navigation)
  const handleGetDirections = () => {
    if (!event || !event.coordinates || !userLocation) return;

    try {
      // Track the directions request
      eventAnalytics.trackGetDirections(event, userLocation);

      const [longitude, latitude] = event.coordinates;
      const [userLongitude, userLatitude] = userLocation;

      const url = Platform.select({
        ios: `maps:?saddr=${userLatitude},${userLongitude}&daddr=${latitude},${longitude}`,
        android: `google.navigation:q=${latitude},${longitude}`,
      });

      if (url) {
        Linking.openURL(url);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error("Error getting directions:", err);
    }
  };

  // Add RSVP handler
  const handleToggleRsvp = async () => {
    if (rsvpState === "loading" || !event || !event.id) return;

    setRsvpState("loading");
    const newRsvpState = !isRsvped;

    try {
      const response = await apiClient.events.toggleRsvpEvent(
        event.id,
        newRsvpState ? "GOING" : "NOT_GOING",
      );
      setIsRsvped(response.status === "GOING");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Track the RSVP action using the available analytics method
      // Since we don't have a specific RSVP tracking method, we'll use save tracking
      eventAnalytics.trackEventSave(
        event,
        response.status === "GOING" ? "save" : "unsave",
      );
    } catch (error) {
      console.error("Error toggling RSVP:", error);
      // Revert optimistic update on error
      setIsRsvped(!newRsvpState);
      Alert.alert("Error", "Failed to update RSVP status. Please try again.");
    } finally {
      setRsvpState("idle");
    }
  };

  return {
    handleGetDirections,
    handleShare,
    handleToggleSave,
    handleBack,
    handleOpenMaps,
    handleRetry,
    handleToggleRsvp,
    loading,
    error,
    isSaved,
    isAdmin,
    saveCount,
    distanceInfo,
    savingState,
    event,
    isLoadingLocation,
    userLocation,
    isRsvped,
    rsvpState,
  };
};
