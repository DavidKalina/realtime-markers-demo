import { AuthWrapper } from "@/components/AuthWrapper";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient, CivicEngagementType } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Book, List, MapPin as MapPinIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import type { CreateCivicEngagementPayload } from "@/services/ApiClient";
import {
  LocationSelector,
  LocationOption,
} from "@/components/LocationSelector/LocationSelector";
import {
  CheckboxGroup,
  SelectableItem,
} from "@/components/CheckboxGroup/CheckboxGroup";

const CreateCivicEngagement = () => {
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

  // Initialize state with values from params if they exist
  const [title, setTitle] = useState((params.title as string) || "");
  const [description, setDescription] = useState(
    (params.description as string) || "",
  );
  const [type, setType] = useState<CivicEngagementType>(
    (params.type as CivicEngagementType) || CivicEngagementType.IDEA,
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
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    // Check if we have coordinates (either from params or selected location)
    if (!coordinates) {
      Alert.alert("Error", "Location coordinates are required");
      return;
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsSubmitting(true);

    try {
      const civicEngagementData: CreateCivicEngagementPayload = {
        title: title.trim(),
        description: description.trim(),
        type: type,
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
        civicEngagementData.address = locationData.address;
        civicEngagementData.locationNotes = locationData.locationNotes;
      }

      if (params.id) {
        // Update existing civic engagement
        await apiClient.civicEngagements.updateCivicEngagement(
          params.id as string,
          civicEngagementData,
        );
        Alert.alert("Success", "Your civic engagement has been updated.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        // Create new civic engagement
        await apiClient.civicEngagements.createCivicEngagement(
          civicEngagementData,
        );
        Alert.alert(
          "Success",
          "Your civic engagement has been submitted and is being processed. You'll be notified when it's ready.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error creating civic engagement:", error);
      Alert.alert(
        "Error",
        "Failed to submit civic engagement. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeOptions: SelectableItem[] = [
    {
      id: CivicEngagementType.IDEA,
      firstName: "💡 Idea",
      lastName: "Share a new idea or suggestion",
    },
    {
      id: CivicEngagementType.POSITIVE_FEEDBACK,
      firstName: "👍 Positive Feedback",
      lastName: "Share positive feedback about something",
    },
    {
      id: CivicEngagementType.NEGATIVE_FEEDBACK,
      firstName: "👎 Negative Feedback",
      lastName: "Share concerns or issues that need attention",
    },
  ];

  const selectedTypeOption = typeOptions.find((option) => option.id === type);

  const handleTypeSelectionChange = (selectedItems: SelectableItem[]) => {
    // Since we only want single selection, take the last selected item
    if (selectedItems.length > 0) {
      const lastSelected = selectedItems[selectedItems.length - 1];
      setType(lastSelected.id as CivicEngagementType);
    }
  };

  // Convert selected type to array format for CheckboxGroup
  const selectedTypeItems = selectedTypeOption ? [selectedTypeOption] : [];

  return (
    <AuthWrapper>
      <Screen
        bannerTitle={"Feedback"}
        showBackButton={true}
        onBack={() => router.back()}
        footerButtons={[
          {
            label: isSubmitting
              ? "Submitting..."
              : params.title
                ? "Update"
                : "Submit",
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
            <Text style={styles.sectionLabel}>Civic Engagement Details</Text>
            <Input
              ref={titleInputRef}
              placeholder="Title"
              icon={Book}
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={handleTitleSubmit}
              returnKeyType="next"
              autoFocus={true}
              blurOnSubmit={false}
            />
            <TextArea
              ref={descriptionInputRef}
              placeholder="Description (optional)"
              icon={List}
              value={description}
              onChangeText={setDescription}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type</Text>
            <CheckboxGroup
              selectedItems={selectedTypeItems}
              onSelectionChange={handleTypeSelectionChange}
              items={typeOptions}
              buttonText="Select civic engagement type"
              modalTitle="Select Type"
              emptyMessage="No types available"
              loadingMessage="Loading types..."
              errorMessage="Error loading types"
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
  mapSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mapInstruction: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    marginBottom: 16,
  },
});

export default CreateCivicEngagement;
