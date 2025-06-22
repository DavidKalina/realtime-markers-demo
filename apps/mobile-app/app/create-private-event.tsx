import { AuthWrapper } from "@/components/AuthWrapper";
import EmbeddedDateRangeCalendar from "@/components/EmbeddedDateRangeCalendar";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Book, List, MapPin as MapPinIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import type { CreateEventPayload } from "@/services/api/base/types";
import {
  LocationSelector,
  LocationOption,
} from "@/components/LocationSelector/LocationSelector";

const CreatePrivateEvent = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    // Initialize from params if they exist
    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude as string);
      const lng = parseFloat(params.longitude as string);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  });
  const [locationData, setLocationData] = useState<LocationOption | null>(
    () => {
      // Initialize from params if they exist
      if (params.latitude && params.longitude) {
        const lat = parseFloat(params.latitude as string);
        const lng = parseFloat(params.longitude as string);
        if (!isNaN(lat) && !isNaN(lng)) {
          return {
            id: "initial",
            name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            address: "Selected coordinates",
            coordinates: [lng, lat],
          };
        }
      }
      return null;
    },
  );
  const [searchResults, setSearchResults] = useState<LocationOption[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [locationError, setLocationError] = useState<string>("");

  // Add helper function to check if a date is at least 15 minutes in the future
  const isAtLeast15MinutesInFuture = useCallback((date: Date) => {
    const now = new Date();
    const minDate = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    return date >= minDate;
  }, []);

  // Initialize state with values from params if they exist
  const [date, setDate] = useState(new Date());
  const [eventName, setEventName] = useState((params.title as string) || "");
  const [eventDescription, setEventDescription] = useState(
    (params.description as string) || "",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add effect to focus title input when component mounts
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  const handleTitleSubmit = () => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  };

  const handleSearchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearchingPlaces(true);
    try {
      const result = await apiClient.places.searchPlace({
        query: query,
      });

      if (result.success && result.place) {
        setSearchResults([
          {
            id: result.place.placeId,
            name: result.place.name,
            address: result.place.address,
            coordinates: result.place.coordinates,
            types: result.place.types,
            rating: result.place.rating,
            userRatingsTotal: result.place.userRatingsTotal,
            locationNotes: result.place.locationNotes,
          },
        ]);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching places:", error);
      setLocationError("Failed to search places. Please try again.");
    } finally {
      setIsSearchingPlaces(false);
    }
  }, []);

  const handleLocationSelect = useCallback((location: LocationOption) => {
    setLocationData(location);
    setCoordinates({
      latitude: location.coordinates[1],
      longitude: location.coordinates[0],
    });
    setLocationError("");
  }, []);

  const handleLocationClear = useCallback(() => {
    setLocationData(null);
    setCoordinates(null);
    setLocationError("");
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    if (!eventName.trim()) {
      Alert.alert("Error", "Please enter an event name");
      return;
    }

    // Check if we have coordinates (either from params or selected location)
    if (!coordinates) {
      Alert.alert("Error", "Location coordinates are required");
      return;
    }

    // Check if the selected date is at least 15 minutes in the future
    if (!isAtLeast15MinutesInFuture(date)) {
      Alert.alert(
        "Error",
        "Event must be scheduled at least 15 minutes in the future",
      );
      return;
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsSubmitting(true);

    try {
      const eventData: CreateEventPayload = {
        title: eventName.trim(),
        description: eventDescription.trim(),
        date: date.toISOString(),
        eventDate: date.toISOString(),
        isPrivate: true,
        // Location is required by the API, and we've validated coordinates exist
        location: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude] as [
            number,
            number,
          ],
        },
      };

      // Add additional location data if available
      if (locationData) {
        eventData.address = locationData.address;
        eventData.locationNotes = locationData.locationNotes;
      }

      // Include userCoordinates since we have coordinates
      eventData.userCoordinates = {
        lat: coordinates.latitude,
        lng: coordinates.longitude,
      };

      if (params.id) {
        // Update existing event
        await apiClient.events.updateEvent(params.id as string, eventData);
        Alert.alert("Success", "Your event has been updated.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        // Create new event
        await apiClient.events.createPrivateEvent(eventData);
        Alert.alert(
          "Success",
          "Your event is being created. You'll be notified when it's ready.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error creating event:", error);
      Alert.alert("Error", "Failed to process event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const localDate = new Date(date);
  localDate.setHours(date.getHours());
  localDate.setMinutes(date.getMinutes());

  return (
    <AuthWrapper>
      <Screen
        bannerTitle={params.title ? "Update Event" : "Create Event"}
        showBackButton={true}
        onBack={() => router.back()}
        footerButtons={[
          {
            label: isSubmitting
              ? "Processing..."
              : params.title
                ? "Update Event"
                : "Create Event",
            onPress: handleSubmit,
            variant: "primary",
            loading: isSubmitting,
            style: { flex: 1 },
          },
        ]}
        isScrollable={true}
        noSafeArea={false}
        extendBannerToStatusBar={false}
      >
        <View style={styles.container}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Event Details</Text>
            <Input
              ref={titleInputRef}
              placeholder="Event Name"
              icon={Book}
              value={eventName}
              onChangeText={setEventName}
              onSubmitEditing={handleTitleSubmit}
              returnKeyType="next"
              autoFocus={true}
              blurOnSubmit={false}
            />
            <TextArea
              ref={descriptionInputRef}
              placeholder="Event Description"
              icon={List}
              value={eventDescription}
              onChangeText={setEventDescription}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPinIcon size={18} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <LocationSelector
              selectedLocation={locationData}
              onLocationSelect={handleLocationSelect}
              onLocationClear={handleLocationClear}
              onSearch={handleSearchPlaces}
              isLoading={isSearchingPlaces}
              searchResults={searchResults}
              error={locationError}
              buttonText="Search for a place..."
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Date & Time</Text>
            <EmbeddedDateRangeCalendar date={date} onDateChange={setDate} />
          </View>
        </View>
      </Screen>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
  },
});

export default CreatePrivateEvent;
