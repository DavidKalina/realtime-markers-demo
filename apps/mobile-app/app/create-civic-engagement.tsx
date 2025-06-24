import { AuthWrapper } from "@/components/AuthWrapper";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient, CivicEngagementType } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Book, List, MapPin as MapPinIcon, Camera } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import type { CreateCivicEngagementPayload } from "@/services/ApiClient";
import {
  LocationSelector,
  LocationOption,
} from "@/components/LocationSelector/LocationSelector";
import {
  CheckboxGroup,
  SelectableItem,
} from "@/components/CheckboxGroup/CheckboxGroup";
import * as ImagePicker from "expo-image-picker";
import { manipulateImage } from "@/utils/imageUtils";

const CreateCivicEngagement = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);

  // Photo state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBuffer, setImageBuffer] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    // Initialize from params if they exist
    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude as string);
      const lng = parseFloat(params.longitude as string);
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(
          "[CreateCivicEngagement] Initializing coordinates from params:",
          {
            latitude: lat,
            longitude: lng,
            source: "scan_screen",
          },
        );
        return { latitude: lat, longitude: lng };
      }
    }
    console.log(
      "[CreateCivicEngagement] No coordinates in params or invalid values:",
      {
        latitude: params.latitude,
        longitude: params.longitude,
      },
    );
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

  // Handle imageUri parameter from scan screen
  useEffect(() => {
    const imageUri = params.imageUri as string;
    if (imageUri) {
      console.log(
        "[CreateCivicEngagement] Processing imageUri from scan:",
        imageUri,
      );
      setSelectedImage(imageUri);

      // Process the image for upload
      const processImageFromScan = async () => {
        try {
          setIsProcessingImage(true);

          // Check if the URI is processable (should be a local file URI)
          if (
            !imageUri.startsWith("file://") &&
            !imageUri.startsWith("content://") &&
            !imageUri.startsWith("data:")
          ) {
            console.warn(
              "[CreateCivicEngagement] Image URI is not a local file or data URI, skipping processing:",
              imageUri,
            );
            // For simulation or non-local images, just set the image without processing
            setSelectedImage(imageUri);
            setIsProcessingImage(false);
            return;
          }

          // For data URIs (simulation), skip processing
          if (imageUri.startsWith("data:")) {
            console.log(
              "[CreateCivicEngagement] Data URI detected, skipping image processing for simulation",
            );
            setSelectedImage(imageUri);
            setIsProcessingImage(false);
            return;
          }

          const processedImage = await manipulateImage(imageUri);

          // Convert to base64 for API
          const response = await fetch(processedImage.uri);
          const blob = await response.blob();
          const reader = new FileReader();

          reader.onload = () => {
            const base64String = reader.result as string;
            // Remove the data:image/jpeg;base64, prefix
            const base64Data = base64String.split(",")[1];
            setImageBuffer(base64Data);
          };

          reader.readAsDataURL(blob);
        } catch (error) {
          console.error("Error processing image from scan:", error);
          // Don't show an alert for simulation errors, just log them
          if (!imageUri.includes("simulation")) {
            Alert.alert(
              "Error",
              "Failed to process image from scan. Please try again.",
            );
          }
        } finally {
          setIsProcessingImage(false);
        }
      };

      processImageFromScan();
    }
  }, [params.imageUri]);

  const handleTitleSubmit = () => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  };

  // Photo handling functions
  const handlePickImage = async () => {
    try {
      // Request permission first
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission",
          "Permission to access media library is required!",
        );
        return;
      }

      setIsProcessingImage(true);

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);

        // Process the image for upload
        const processedImage = await manipulateImage(imageUri);

        // Convert to base64 for API
        const response = await fetch(processedImage.uri);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onload = () => {
          const base64String = reader.result as string;
          // Remove the data:image/jpeg;base64, prefix
          const base64Data = base64String.split(",")[1];
          setImageBuffer(base64Data);
        };

        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedImage(null);
    setImageBuffer(null);
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
      // Prepare civic engagement data
      const civicEngagementData: CreateCivicEngagementPayload = {
        title: title.trim(),
        description: description.trim(),
        type: type,
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

      // Add image data if available
      if (imageBuffer) {
        civicEngagementData.imageBuffer = imageBuffer;
        civicEngagementData.contentType = "image/jpeg";
        civicEngagementData.filename = "civic-engagement.jpg";
      }

      if (params.id) {
        // Update existing civic engagement
        await apiClient.civicEngagements.updateCivicEngagement(
          params.id as string,
          civicEngagementData,
        );
      } else {
        // Create new civic engagement
        await apiClient.civicEngagements.createCivicEngagement(
          civicEngagementData,
        );
      }

      Alert.alert(
        "Success",
        params.id
          ? "Your civic engagement has been updated."
          : "Your civic engagement has been submitted successfully!",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
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

  const handleTakePhoto = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission", "Camera access is required to take a photo.");
        return;
      }
      setIsProcessingImage(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        const processedImage = await manipulateImage(imageUri);
        const response = await fetch(processedImage.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(",")[1];
          setImageBuffer(base64Data);
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setIsProcessingImage(false);
    }
  };

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
            <Text style={styles.sectionLabel}>Feedback Details</Text>
            <Input
              ref={titleInputRef}
              placeholder="Title"
              icon={Book}
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={handleTitleSubmit}
              returnKeyType="next"
              autoFocus={false}
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
              buttonText="Select feedback type"
              modalTitle="Feedback Type"
              emptyMessage="No types available"
              loadingMessage="Loading types..."
              errorMessage="Error loading types"
              initialModalOpen={true}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photo (Optional)</Text>
            <View style={styles.photoSection}>
              {selectedImage ? (
                <View style={styles.photoPreviewContainer}>
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.photoPreview}
                  />
                  <View style={styles.photoActions}>
                    {isProcessingImage && (
                      <View style={styles.processingIndicator}>
                        <ActivityIndicator size="small" color={COLORS.accent} />
                        <Text style={styles.processingText}>Processing...</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={handleRemovePhoto}
                      disabled={isProcessingImage}
                    >
                      <Text style={styles.removePhotoText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoButtonsRow}>
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={handleTakePhoto}
                    disabled={isProcessingImage}
                  >
                    <Camera size={22} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.photoButtonText}>
                      {isProcessingImage ? "Processing..." : "Take Photo"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={handlePickImage}
                    disabled={isProcessingImage}
                  >
                    <Camera size={22} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.photoButtonText}>
                      {isProcessingImage ? "Processing..." : "Choose Photo"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
              buttonText={
                locationData ? "Change location..." : "Search for a place..."
              }
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
  photoSection: {
    alignItems: "flex-start",
  },
  photoPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.cardBackground,
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  processingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
  },
  removePhotoButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f97583",
    borderRadius: 8,
  },
  removePhotoText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: "Poppins-Regular",
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    marginTop: 4,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Poppins-Regular",
  },
  photoButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
});

export default CreateCivicEngagement;
