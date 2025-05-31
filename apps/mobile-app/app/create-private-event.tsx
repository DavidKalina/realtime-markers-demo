import { CheckboxGroup } from "@/components/CheckboxGroup/CheckboxGroup";
import EmbeddedDateRangeCalendar from "@/components/EmbeddedDateRangeCalendar";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import Header from "@/components/Layout/Header";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import { Select, SelectOption } from "@/components/Select/Select";
import { Friend, apiClient } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Book, List, MapPin as MapPinIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

// Unified color theme matching Login screen
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
};

const MapPin = ({ size, color }: { size: number; color: string }) => (
  <MapPinIcon size={size} color={color} />
);

// Add useDebounce hook at the top of the file
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

const CreatePrivateEvent = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationData, setLocationData] = useState<{
    placeId: string;
    name: string;
    address: string;
    types?: string[];
    rating?: number;
    userRatingsTotal?: number;
    locationNotes?: string;
  } | null>(null);
  const [searchResults, setSearchResults] = useState<SelectOption[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [locationError, setLocationError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // 500ms delay

  useEffect(() => {
    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude as string);
      const lng = parseFloat(params.longitude as string);

      if (!isNaN(lat) && !isNaN(lng)) {
        setCoordinates({ latitude: lat, longitude: lng });
        console.log("Received coordinates:", { latitude: lat, longitude: lng });
      }
    }
  }, [params.latitude, params.longitude]);

  // Initialize state with values from params if they exist
  const [date, setDate] = useState(() => {
    const now = new Date();
    const minDate = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    return params.eventDate ? new Date(params.eventDate as string) : minDate;
  });
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [eventName, setEventName] = useState((params.title as string) || "");
  const [eventDescription, setEventDescription] = useState(
    (params.description as string) || "",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const buttonScale = useSharedValue(1);

  // Add effect to initialize selected friends in edit mode
  useEffect(() => {
    const initializeSelectedFriends = async () => {
      if (params.id) {
        try {
          // Get the event details including shares
          const event = await apiClient.events.getEventById(
            params.id as string,
          );
          if (event) {
            // Get all friends
            const friends = await apiClient.friends.getFriends();

            // Get the shares for this event
            const shares = await apiClient.events.getEventShares(
              params.id as string,
            );

            // Get the IDs of users the event is shared with
            const sharedWithIds = shares.map((share) => share.sharedWithId);

            // Filter friends to only those that are in sharedWithIds
            const selectedFriends = friends.filter((friend) =>
              sharedWithIds.includes(friend.id),
            );
            setSelectedFriends(selectedFriends);

            // Also set other event details if they exist
            if (event.title) setEventName(event.title);
            if (event.description) setEventDescription(event.description);
            if (event.eventDate) setDate(new Date(event.eventDate));
            if (
              event.location &&
              typeof event.location === "object" &&
              "coordinates" in event.location
            ) {
              const location = event.location as {
                coordinates: [number, number];
              };
              setCoordinates({
                latitude: location.coordinates[1],
                longitude: location.coordinates[0],
              });
            }
          }
        } catch (error) {
          console.error("Error initializing event details:", error);
        }
      }
    };

    initializeSelectedFriends();
  }, [params.id]);

  // Add effect to focus title input when component mounts
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handleTitleSubmit = () => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  };

  // Update handleSearchPlaces to use the debounced query
  const handleSearchPlaces = useCallback(async (query: string) => {
    setSearchQuery(query); // Just update the query state, actual search will be triggered by debounced value
  }, []);

  // Add effect to handle the actual search with debounced value
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearchingPlaces(true);
      try {
        const result = await apiClient.places.searchPlace({
          query: debouncedSearchQuery,
        });

        if (result.success && result.place) {
          setSearchResults([
            {
              id: result.place.placeId,
              label: result.place.name,
              description: result.place.address,
              icon: MapPin,
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
    };

    performSearch();
  }, [debouncedSearchQuery]);

  const handleLocationSelect = useCallback(async (option: SelectOption) => {
    try {
      // Get the full place data to access coordinates
      const placeData = await apiClient.places.searchPlace({
        query: option.label,
      });

      if (placeData.success && placeData.place?.coordinates) {
        const [lng, lat] = placeData.place.coordinates;
        setCoordinates({ latitude: lat, longitude: lng });
        setLocationData({
          placeId: placeData.place.placeId,
          name: placeData.place.name,
          address: placeData.place.address,
          types: placeData.place.types,
          rating: placeData.place.rating,
          userRatingsTotal: placeData.place.userRatingsTotal,
          locationNotes: placeData.place.locationNotes,
        });
        setLocationError("");
      } else {
        throw new Error("Invalid place data received");
      }
    } catch (error) {
      console.error("Error getting place details:", error);
      setLocationError("Failed to get place details. Please try again.");
    }
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    if (!eventName.trim()) {
      Alert.alert("Error", "Please enter an event name");
      return;
    }

    if (!coordinates || !locationData) {
      Alert.alert("Error", "Location is required");
      return;
    }

    // Check if the selected date is at least 5 minutes in the future
    const now = new Date();
    const minDate = new Date(now.getTime() + 5 * 60 * 1000);

    if (date < minDate) {
      Alert.alert(
        "Error",
        "Event must be scheduled at least 5 minutes in the future",
      );
      return;
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    setIsSubmitting(true);

    try {
      const eventData = {
        title: eventName.trim(),
        description: eventDescription.trim(),
        eventDate: date.toISOString(),
        date: date.toISOString(),
        location: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude] as [
            number,
            number,
          ],
          placeId: locationData.placeId,
          name: locationData.name,
          address: locationData.address,
          types: locationData.types,
          rating: locationData.rating,
          userRatingsTotal: locationData.userRatingsTotal,
          locationNotes: locationData.locationNotes,
        },
        sharedWithIds: selectedFriends.map((friend) => friend.id),

        userCoordinates: {
          lat: coordinates.latitude,
          lng: coordinates.longitude,
        },
        isPrivate: true,
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

  const selectedLocation: SelectOption | undefined = locationData
    ? {
        id: locationData.placeId,
        label: locationData.name,
        description: locationData.address,
        icon: MapPin,
      }
    : undefined;

  const localDate = new Date(date);
  localDate.setHours(date.getHours());
  localDate.setMinutes(date.getMinutes());

  return (
    <ScreenLayout>
      <Header
        title={params.title ? "Update Event" : "Create Event"}
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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
              <Select
                value={selectedLocation}
                options={searchResults}
                placeholder="Search for a place..."
                searchable
                loading={isSearchingPlaces}
                onSearch={handleSearchPlaces}
                onChange={handleLocationSelect}
                onClear={() => {
                  setCoordinates(null);
                  setLocationData(null);
                  setLocationError("");
                  setSearchQuery(""); // Clear the search query
                }}
                error={locationError}
                style={styles.input}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Invite Friends</Text>
              <CheckboxGroup
                selectedFriends={selectedFriends}
                onSelectionChange={setSelectedFriends}
                buttonText="Select Friends to Invite"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Date & Time</Text>
              <EmbeddedDateRangeCalendar date={date} onDateChange={setDate} />
            </View>

            <View style={styles.submitButtonContainer}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.7}
                style={[styles.submitButton, buttonAnimatedStyle]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {params.title ? "Update Event" : "Create Event"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
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
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  submitButtonContainer: {
    marginTop: 20,
    paddingBottom: 40,
  },
  submitButton: {
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  submitButtonText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  dateDisplay: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  dateText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  localTimeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginTop: 4,
  },
  callout: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },
  calloutText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
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
    fontFamily: "SpaceMono",
  },
  input: {
    marginBottom: 16,
  },
});

export default CreatePrivateEvent;
