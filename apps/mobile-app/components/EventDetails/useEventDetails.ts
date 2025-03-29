import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/contexts/LocationContext";
import apiClient from "@/services/ApiClient";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Linking, Alert, Platform } from "react-native";
import { calculateDistance, formatDistance } from "@/utils/distanceUtils";
import * as Haptics from "expo-haptics";
import { formatDate } from "@/utils/dateTimeFormatting";
import { EventType } from "@/types/types";

export const useEventDetails = (eventId: string, onBack?: () => void) => {
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [savingState, setSavingState] = useState<"idle" | "loading">("idle");
  const router = useRouter();

  console.log(JSON.stringify(event, null, 2));

  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  // Get user location from our context
  const { userLocation, isLoadingLocation } = useUserLocation();

  // Calculate distance when we have both user location and event data
  const [distanceInfo, setDistanceInfo] = useState<string | null>(null);

  // Fetch event details when eventId changes
  useEffect(() => {
    let isMounted = true;

    const fetchEventDetails = async () => {
      if (!eventId) return;

      setLoading(true);
      setError(null);

      try {
        const eventData = await apiClient.getEventById(eventId);

        if (isMounted) {
          setEvent(eventData);
          // If we have saveCount from the event, initialize it
          if (eventData.saveCount !== undefined) {
            setSaveCount(eventData.saveCount);
          }
        }

        // Check if event is saved by the user
        if (apiClient.isAuthenticated()) {
          try {
            const { isSaved: savedStatus } = await apiClient.isEventSaved(eventId);
            if (isMounted) {
              setIsSaved(savedStatus);
            }
          } catch (saveErr) {
            console.error("Error checking save status:", saveErr);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
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
  }, [eventId]);

  // Update distance whenever user location or event coordinates change
  useEffect(() => {
    if (!event || !event.coordinates || !userLocation) {
      setDistanceInfo(null);
      return;
    }

    try {
      // Calculate distance between user and event
      const distance = calculateDistance(userLocation, event.coordinates);
      if (distance !== null) {
        setDistanceInfo(formatDistance(distance));
      } else {
        setDistanceInfo(null);
      }
    } catch (err) {
      console.error("Error calculating distance:", err);
      setDistanceInfo(null);
    }
  }, [userLocation, event]);

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
    apiClient
      .getEventById(eventId)
      .then((data) => setEvent(data))
      .catch((err) =>
        setError(
          `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      )
      .finally(() => setLoading(false));
  };

  // Handle save/unsave toggle
  const handleToggleSave = async () => {
    if (!apiClient.isAuthenticated()) {
      // Navigate to login if user is not authenticated
      router.push("/login");
      return;
    }

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic UI update
    setIsSaved((prevState) => !prevState);
    setSaveCount((prevCount) => (isSaved ? prevCount - 1 : prevCount + 1));

    setSavingState("loading");

    try {
      const result = await apiClient.toggleSaveEvent(eventId);

      // Update with the actual state from the server
      setIsSaved(result.saved);
      setSaveCount(result.saveCount);
    } catch (err) {
      console.error("Error toggling save status:", err);

      // Revert optimistic update on error
      setIsSaved((prevState) => !prevState);
      setSaveCount((prevCount) => (isSaved ? prevCount + 1 : prevCount - 1));

      // Could show an error toast here
    } finally {
      setSavingState("idle");
    }
  };

  const handleShare = async () => {
    if (!event) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create a shareable message
      const message = `${event.title}\n\n📅 ${formatDate(event.eventDate, event.timezone)}\n📍 ${event.location
        }\n\n${event.description || ""}`;

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
    if (!event || !event.location) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let url;
      const address = encodeURIComponent(event.location);

      // If we have coordinates, use them for more precise location
      if (event.coordinates && event.coordinates.length === 2) {
        const [longitude, latitude] = event.coordinates;

        if (Platform.OS === "ios") {
          url = `maps:0,0?q=${latitude},${longitude}`;
        } else {
          url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${address})`;
        }
      } else {
        // Otherwise use address
        if (Platform.OS === "ios") {
          url = `maps:0,0?q=${address}`;
        } else {
          url = `geo:0,0?q=${address}`;
        }
      }

      Linking.openURL(url);
    } catch (err) {
      console.error("Error opening maps:", err);
      Alert.alert("Navigation Failed", "Could not open maps application.");
    }
  };

  // Handle get directions (uses turn-by-turn navigation)
  const handleGetDirections = () => {
    if (!event?.coordinates || !userLocation) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const [longitude, latitude] = event.coordinates;

      // Create navigation URL based on platform
      let url;
      if (Platform.OS === "ios") {
        // Apple Maps
        url = `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
      } else {
        // Google Maps
        url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      }

      Linking.openURL(url);
    } catch (err) {
      console.error("Error opening directions:", err);
      Alert.alert("Navigation Failed", "Could not open navigation application.");
    }
  };

  return {
    handleGetDirections,
    handleShare,
    handleToggleSave,
    handleBack,
    handleOpenMaps,
    handleRetry,
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
  };
};
