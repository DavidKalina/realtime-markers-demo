import { AuthWrapper } from "@/components/AuthWrapper";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient, CivicEngagementType } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Book, List, MapPin as MapPinIcon, Camera } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  memo,
} from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import MapboxGL from "@rnmapbox/maps";

// Memoized map marker component
const MapMarker = memo(({ coordinates }: { coordinates: [number, number] }) => (
  <MapboxGL.MarkerView coordinate={coordinates} anchor={{ x: 0.5, y: 0.5 }}>
    <View style={styles.mapMarker}>
      <View style={styles.mapMarkerDot} />
    </View>
  </MapboxGL.MarkerView>
));

// Memoized photo preview component
const PhotoPreview = memo(
  ({
    selectedImage,
    isProcessingImage,
    onRemovePhoto,
  }: {
    selectedImage: string;
    isProcessingImage: boolean;
    onRemovePhoto: () => void;
  }) => (
    <View style={styles.photoPreviewContainer}>
      <Image source={{ uri: selectedImage }} style={styles.photoPreview} />
      <View style={styles.photoActions}>
        {isProcessingImage && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.removePhotoButton}
          onPress={onRemovePhoto}
          disabled={isProcessingImage}
        >
          <Text style={styles.removePhotoText}>Remove Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  ),
);

// Memoized photo buttons component
const PhotoButtons = memo(
  ({
    isProcessingImage,
    onTakePhoto,
    onPickImage,
  }: {
    isProcessingImage: boolean;
    onTakePhoto: () => void;
    onPickImage: () => void;
  }) => (
    <View style={styles.photoButtonsRow}>
      <TouchableOpacity
        style={styles.photoButton}
        onPress={onTakePhoto}
        disabled={isProcessingImage}
      >
        <Camera size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.photoButtonText}>
          {isProcessingImage ? "Processing..." : "Take Photo"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.photoButton}
        onPress={onPickImage}
        disabled={isProcessingImage}
      >
        <Camera size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.photoButtonText}>
          {isProcessingImage ? "Processing..." : "Choose Photo"}
        </Text>
      </TouchableOpacity>
    </View>
  ),
);

// Memoized Civic Engagement Map Preview Component
const CivicEngagementMapPreview = memo<{
  coordinates: [number, number];
  locationName: string;
}>(({ coordinates, locationName }) => {
  const mapStyle = useMemo(() => MapboxGL.StyleURL.SatelliteStreet, []);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Set camera position when map is ready
  useEffect(() => {
    if (isMapReady && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: coordinates,
        zoomLevel: 16,
        animationDuration: 0,
      });
    }
  }, [isMapReady, coordinates]);

  return (
    <View style={styles.mapPreviewContainer}>
      <View style={styles.mapPreview}>
        <MapboxGL.MapView
          pitchEnabled={false}
          zoomEnabled={false}
          compassEnabled={false}
          scrollEnabled={false}
          rotateEnabled={false}
          scaleBarEnabled={false}
          style={styles.mapView}
          styleURL={mapStyle}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            zoomLevel={18}
            centerCoordinate={coordinates}
            animationDuration={0}
          />
          <MapMarker coordinates={coordinates} />
        </MapboxGL.MapView>
        <View style={styles.coordinatesOverlay}>
          <Text style={styles.coordinatesText}>
            {coordinates[1].toFixed(6)}, {coordinates[0].toFixed(6)}
          </Text>
        </View>
      </View>
      <Text style={styles.mapLocationText}>{locationName}</Text>
    </View>
  );
});

const CreateCivicEngagement = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Photo state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBuffer, setImageBuffer] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Memoize initial coordinates calculation
  const initialCoordinates = useMemo(() => {
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
  }, [params.latitude, params.longitude]);

  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialCoordinates);

  // Memoize initial location data
  const initialLocationData = useMemo(() => {
    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude as string);
      const lng = parseFloat(params.longitude as string);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          id: "initial",
          name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          address: "Selected coordinates",
          coordinates: [lng, lat] as [number, number],
        };
      }
    }
    return null;
  }, [params.latitude, params.longitude]);

  const [locationData, setLocationData] = useState<LocationOption | null>(
    initialLocationData,
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

  // Memoize type options to prevent recreation on every render
  const typeOptions = useMemo<SelectableItem[]>(
    () => [
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
    ],
    [],
  );

  // Memoize selected type option
  const selectedTypeOption = useMemo(
    () => typeOptions.find((option) => option.id === type),
    [typeOptions, type],
  );

  // Memoize selected type items for CheckboxGroup
  const selectedTypeItems = useMemo(
    () => (selectedTypeOption ? [selectedTypeOption] : []),
    [selectedTypeOption],
  );

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

  const handleTitleSubmit = useCallback(() => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      // Scroll to description input after a short delay
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, []);

  // Photo handling functions
  const handlePickImage = useCallback(async () => {
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
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setSelectedImage(null);
    setImageBuffer(null);
  }, []);

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

  const handleSubmit = useCallback(async () => {
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
        console.log("[CreateCivicEngagement] Submitting civic engagement...");
        const response =
          await apiClient.civicEngagements.createCivicEngagement(
            civicEngagementData,
          );
        console.log("[CreateCivicEngagement] Response:", response);
      }

      Alert.alert(
        "Success",
        params.id
          ? "Your civic engagement has been updated."
          : "Your civic engagement has been submitted successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              if (params.id) {
                // For updates, go back to previous screen
                router.back();
              } else {
                // For new submissions, replace the current screen with jobs screen to see processing
                // Using replace instead of push to properly close the modal
                router.replace("/");
              }
            },
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
  }, [
    isSubmitting,
    title,
    coordinates,
    type,
    description,
    locationData,
    imageBuffer,
    params.id,
    router,
  ]);

  // Memoize footer buttons configuration - moved after handleSubmit
  const footerButtons = useMemo(
    () => [
      {
        label: isSubmitting
          ? "Submitting..."
          : params.title
            ? "Update"
            : "Submit",
        onPress: handleSubmit,
        variant: "primary" as const,
        loading: isSubmitting,
        style: {
          flex: 1,
          borderRadius: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        textStyle: {
          fontSize: 16,
          letterSpacing: 0.5,
        },
      },
    ],
    [isSubmitting, params.title, handleSubmit],
  );

  const handleTypeSelectionChange = useCallback(
    (selectedItems: SelectableItem[]) => {
      // Since we only want single selection, take the last selected item
      if (selectedItems.length > 0) {
        const lastSelected = selectedItems[selectedItems.length - 1];
        setType(lastSelected.id as CivicEngagementType);
      }
    },
    [],
  );

  const handleTakePhoto = useCallback(async () => {
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
  }, []);

  // Memoize location selector button text
  const locationButtonText = useMemo(
    () => (locationData ? "Change location..." : "Search for a place..."),
    [locationData],
  );

  // Memoize map coordinates for preview
  const mapCoordinates = useMemo(
    () =>
      coordinates
        ? ([coordinates.longitude, coordinates.latitude] as [number, number])
        : null,
    [coordinates],
  );

  return (
    <AuthWrapper>
      <Screen
        bannerTitle={"Feedback"}
        showBackButton={true}
        onBack={() => router.back()}
        footerButtons={footerButtons}
        isScrollable={false}
        noSafeArea={false}
        extendBannerToStatusBar={true}
        footerSafeArea={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            {/* Location Section - First, as it's most important for municipal feedback */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MapPinIcon size={14} color={COLORS.accent} />
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
                buttonText={locationButtonText}
              />
              {mapCoordinates && locationData && (
                <CivicEngagementMapPreview
                  coordinates={mapCoordinates}
                  locationName={locationData.name}
                />
              )}
            </View>

            {/* Type Section - Second, to categorize the feedback */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Feedback Type</Text>
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

            {/* Details Section - Third, for the actual feedback content */}
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

            {/* Photo Section - Last, as supporting documentation */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Photo (Optional)</Text>
              <View style={styles.photoSection}>
                {selectedImage ? (
                  <PhotoPreview
                    selectedImage={selectedImage}
                    isProcessingImage={isProcessingImage}
                    onRemovePhoto={handleRemovePhoto}
                  />
                ) : (
                  <PhotoButtons
                    isProcessingImage={isProcessingImage}
                    onTakePhoto={handleTakePhoto}
                    onPickImage={handlePickImage}
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
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
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: COLORS.cardBackground,
    alignSelf: "stretch",
  },
  photoActions: {
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    width: "100%",
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
    paddingVertical: 12,
    backgroundColor: "#f97583",
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    alignSelf: "stretch",
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
  mapPreviewContainer: {
    marginTop: 12,
    width: "100%",
  },
  mapPreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: COLORS.cardBackground,
    overflow: "hidden",
    position: "relative",
  },
  mapView: {
    width: "100%",
    height: "100%",
  },
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffa500",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  coordinatesOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 4,
    borderRadius: 4,
  },
  coordinatesText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: "Poppins-Regular",
  },
  mapLocationText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginTop: 8,
  },
});

export default CreateCivicEngagement;
