import Header from "@/components/Layout/Header";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from "react-native";
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import DateTimeSelector from "@/components/DateTimeSelector";
import TimeSelector from "@/components/TimeSelector";
import SelectInput from "@/components/Input/SelectInput";
import MultiSelectInput from "@/components/Input/MultiSelectInput";
import { MapPin, Users } from "lucide-react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useLocationSearch } from "@/hooks/useLocationSearch";
import type { LocationSearchResult } from "@/services/ApiClient";
import { useFriendships } from "@/hooks/useFriendships";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import { usePrivateEvent } from "@/hooks/usePrivateEvent";
import { format, parseISO } from "date-fns";
import ClockDial from "@/components/DigitalClock";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DigitalClock from "@/components/DigitalClock";

const CreatePrivateEvent = () => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasInitializedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Use the private event hook
  const { createEvent, isSubmitting, error } = usePrivateEvent();

  // Get coordinates from query params
  const { latitude, longitude } = useLocalSearchParams<{ latitude: string; longitude: string }>();
  const coordinates = useMemo(
    () =>
      latitude && longitude
        ? {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          }
        : null,
    [latitude, longitude]
  );

  // Use the location search hook
  const {
    locationOptions,
    isSearching,
    searchLocations,
    selectedLocation,
    setSelectedLocation,
    getLocationFromCoordinates,
    isGettingLocation,
  } = useLocationSearch({
    userCoordinates: coordinates
      ? { lat: coordinates.latitude, lng: coordinates.longitude }
      : undefined,
  });

  // Use the friendships hook
  const { friends, isLoading: isLoadingFriends } = useFriendships();

  // Transform friends into options format for MultiSelectInput
  const friendOptions = useMemo(() => {
    return friends.map((friend) => ({
      label: friend.displayName || friend.email,
      value: friend.id,
      description: friend.displayName ? friend.email : undefined,
    }));
  }, [friends]);

  // Initial location fetch and selection
  useEffect(() => {
    const initializeLocation = async () => {
      if (!coordinates || hasInitializedRef.current || !isMountedRef.current) {
        setIsInitialLoading(false);
        return;
      }

      try {
        const location = await getLocationFromCoordinates(
          coordinates.latitude,
          coordinates.longitude
        );

        if (location && isMountedRef.current) {
          // Create a LocationSearchResult from the location data
          const locationResult: LocationSearchResult = {
            placeId: location.placeId,
            name: location.address.split(",")[0], // Use first part of address as name
            address: location.formattedAddress,
            coordinates: [coordinates.longitude, coordinates.latitude],
            types: location.types,
          };
          setSelectedLocation(locationResult);
        }
      } catch (error) {
        console.error("Error fetching initial location:", error);
        // If we fail to get the location, we should still allow the user to proceed
        // by manually searching for a location
      } finally {
        if (isMountedRef.current) {
          setIsInitialLoading(false);
          hasInitializedRef.current = true;
        }
      }
    };

    initializeLocation();

    return () => {
      isMountedRef.current = false;
    };
  }, [coordinates, getLocationFromCoordinates, setSelectedLocation]);

  const handleDateRangeSelect = useCallback((start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const handleStartTimeChange = useCallback(
    (newTime: string) => {
      if (startDate) {
        setStartDate(newTime);
      }
    },
    [startDate]
  );

  const handleEndTimeChange = useCallback(
    (newTime: string) => {
      if (endDate) {
        setEndDate(newTime);
      }
    },
    [endDate]
  );

  const handleLocationSearch = useCallback(
    (query: string) => {
      searchLocations(query);
    },
    [searchLocations]
  );

  const handleLocationSelect = useCallback(
    (placeId: string) => {
      const location = locationOptions.find((opt) => opt.value === placeId);
      if (location) {
        setSelectedLocation(location as unknown as LocationSearchResult);
      }
    },
    [locationOptions, setSelectedLocation]
  );

  const handleSubmit = async () => {
    if (!title || !startDate || !selectedLocation) {
      console.error("Missing required fields");
      return;
    }

    console.log("startDate", startDate);
    try {
      const event = await createEvent({
        title,
        description,
        startDate,
        endDate: "",
        location: selectedLocation,
        invitedUserIds: selectedFriendIds,
      });

      // Navigate to the event details page
      router.push({
        pathname: "/details",
        params: { id: event.id },
      });
    } catch (error) {
      console.error("Error creating event:", error);
    }
  };

  if (isInitialLoading && coordinates) {
    return (
      <ScreenLayout>
        <LoadingOverlay
          message="Loading location..."
          subMessage="Please wait while we set up your event location"
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <Header title="Create Private Event" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Input placeholder="Event Title" value={title} onChangeText={setTitle} delay={100} />

        <TextArea
          placeholder="Event Description"
          value={description}
          onChangeText={setDescription}
          delay={200}
          minHeight={120}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <SelectInput
            icon={MapPin}
            options={locationOptions}
            value={selectedLocation?.placeId || ""}
            onChange={handleLocationSearch}
            onSelect={handleLocationSelect}
            placeholder={selectedLocation ? selectedLocation.address : "Search for a location..."}
            loading={isSearching}
            delay={300}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Friends</Text>
          <MultiSelectInput
            icon={Users}
            options={friendOptions}
            values={selectedFriendIds}
            onChange={setSelectedFriendIds}
            placeholder="Select friends to invite"
            maxSelections={10}
            delay={400}
            loading={isLoadingFriends}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <DateTimeSelector isLoading={isSubmitting} onDateSelect={setStartDate} />

          <GestureHandlerRootView>
            <DigitalClock
              onValueChange={(hours, minutes) => {
                if (startDate) {
                  const date = parseISO(startDate);
                  const newDate = new Date(date);
                  newDate.setHours(hours);
                  newDate.setMinutes(minutes);
                  setStartDate(newDate.toISOString());
                }
              }}
            />
          </GestureHandlerRootView>

          {startDate && endDate && (
            <View style={styles.timeSelectorsContainer}>
              <TimeSelector
                time={startDate}
                onChange={handleStartTimeChange}
                disabled={isSubmitting}
                label="Start Time"
              />
              <TimeSelector
                time={endDate}
                onChange={handleEndTimeChange}
                disabled={isSubmitting}
                label="End Time"
              />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!title || !startDate || !endDate || !selectedLocation) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!title || !startDate || !selectedLocation || isSubmitting}
          activeOpacity={0.7}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? "Creating..." : "Create Event"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },
  submitButton: {
    height: 55,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  timeSelectorsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
});

export default CreatePrivateEvent;
