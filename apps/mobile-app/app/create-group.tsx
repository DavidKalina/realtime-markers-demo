import React, { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Alert, View, StyleSheet, Text } from "react-native";
import { Users, MapPin, Lock, Globe } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import { Select, SelectOption } from "@/components/Select/Select";
import { apiClient } from "@/services/ApiClient";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { CategorySelector } from "@/components/CategorySelector/CategorySelector";
import { useCategories } from "@/hooks/useCategories";
import { Category } from "@/services/api/base/types";

// Define types locally since we can't import from @/types/group
enum GroupVisibility {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

interface CreateGroupPayload {
  name: string;
  description?: string;
  visibility: GroupVisibility;
  categories: Category[];
  headquarters: {
    placeId: string;
    name: string;
    address: string;
    coordinates: {
      type: "Point";
      coordinates: [number, number];
    };
  };
}

// Create a wrapper component that matches the expected icon type
const MapPinIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => <MapPin size={size} color={color} />;

const CreateGroupScreen = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<
    Omit<CreateGroupPayload, "headquarters"> & {
      headquarters: {
        placeId: string;
        name: string;
        address: string;
        coordinates: { lat: number; lng: number };
      };
    }
  >({
    name: "",
    description: "",
    visibility: GroupVisibility.PUBLIC,
    categories: [],
    headquarters: {
      placeId: "",
      name: "",
      address: "",
      coordinates: { lat: 0, lng: 0 },
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<SelectOption[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // Add useCategories hook
  const {
    selectedCategories,
    availableCategories,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    handleSearchCategories,
    handleCategoriesChange,
  } = useCategories({
    maxCategories: 5,
    initialCategories: formData.categories,
  });

  // Update formData when categories change
  React.useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      categories: selectedCategories,
    }));
  }, [selectedCategories]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Group name is required";
    } else if (formData.name.length < 3) {
      newErrors.name = "Group name must be at least 3 characters";
    } else if (formData.name.length > 50) {
      newErrors.name = "Group name must be less than 50 characters";
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Description must be less than 500 characters";
    }

    if (!formData.headquarters.placeId) {
      newErrors.headquarters = "Group location is required";
    }

    if (categoriesError) {
      newErrors.categories = categoriesError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, categoriesError]);

  const handleSearchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearchingPlaces(true);
    try {
      const result = await apiClient.places.searchCityState({ query });

      if (result.success && result.cityState) {
        setSearchResults([
          {
            id: result.cityState.placeId,
            label: `${result.cityState.city}, ${result.cityState.state}`,
            description: result.cityState.formattedAddress,
            icon: MapPinIcon,
          },
        ]);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching cities:", error);
      setErrors((prev) => ({
        ...prev,
        headquarters: "Failed to search cities. Please try again.",
      }));
    } finally {
      setIsSearchingPlaces(false);
    }
  }, []);

  const handleLocationSelect = useCallback(async (option: SelectOption) => {
    try {
      // Get the full city state data to access coordinates
      const cityStateData = await apiClient.places.searchCityState({
        query: option.label,
      });

      if (cityStateData.success && cityStateData.cityState?.coordinates) {
        const [lng, lat] = cityStateData.cityState.coordinates;
        setFormData((prev) => ({
          ...prev,
          headquarters: {
            placeId: option.id,
            name: option.label,
            address: option.description || "",
            coordinates: { lat, lng },
          },
        }));
        setErrors((prev) => ({ ...prev, headquarters: "" }));
      } else {
        throw new Error("Invalid city state data received");
      }
    } catch (error) {
      console.error("Error getting city details:", error);
      setErrors((prev) => ({
        ...prev,
        headquarters: "Failed to get city details. Please try again.",
      }));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Transform the coordinates to match the expected type
      const payload: CreateGroupPayload = {
        ...formData,
        headquarters: {
          ...formData.headquarters,
          coordinates: {
            type: "Point",
            coordinates: [
              formData.headquarters.coordinates.lng,
              formData.headquarters.coordinates.lat,
            ],
          },
        },
      };

      const group = await apiClient.groups.createGroup(payload);
      Alert.alert(
        "Success",
        "Group created successfully!",
        [
          {
            text: "View Group",
            onPress: () => {
              router.replace({
                pathname: "/group/[id]",
                params: { id: group.id },
              });
            },
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create group",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, router, validateForm]);

  const selectedHeadquarters: SelectOption | undefined = formData.headquarters
    .placeId
    ? {
        id: formData.headquarters.placeId,
        label: formData.headquarters.name,
        description: formData.headquarters.address,
        icon: MapPinIcon,
      }
    : undefined;

  return (
    <Screen
      bannerTitle="Create Group"
      bannerDescription="Start a new group in your community"
      bannerEmoji="👥"
      showBackButton
      onBack={() => router.back()}
      footerButtons={[
        {
          label: isSubmitting ? "Creating..." : "Create Group",
          onPress: handleSubmit,
          variant: "primary",
        },
      ]}
    >
      <View style={styles.form}>
        <Input
          placeholder="Group Name"
          value={formData.name}
          onChangeText={(text) => {
            setFormData((prev) => ({ ...prev, name: text }));
            setErrors((prev) => ({ ...prev, name: "" }));
          }}
          icon={Users}
          error={errors.name}
          autoCapitalize="words"
          maxLength={50}
          style={styles.input}
        />

        <Input
          placeholder="Description (optional)"
          value={formData.description}
          onChangeText={(text) => {
            setFormData((prev) => ({ ...prev, description: text }));
            setErrors((prev) => ({ ...prev, description: "" }));
          }}
          multiline
          numberOfLines={4}
          maxLength={500}
          error={errors.description}
          style={styles.input}
        />

        {/* Add CategorySelector component */}
        <View style={styles.section}>
          <CategorySelector
            selectedCategories={selectedCategories}
            availableCategories={availableCategories}
            onCategoriesChange={handleCategoriesChange}
            onSearchCategories={handleSearchCategories}
            isLoading={isCategoriesLoading}
            error={errors.categories}
            maxCategories={5}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={18} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Headquarters</Text>
          </View>
          <Select
            value={selectedHeadquarters}
            options={searchResults}
            placeholder="Search for a city or state..."
            searchable
            loading={isSearchingPlaces}
            onSearch={handleSearchPlaces}
            onChange={handleLocationSelect}
            onClear={() => {
              setFormData((prev) => ({
                ...prev,
                headquarters: {
                  placeId: "",
                  name: "",
                  address: "",
                  coordinates: { lat: 0, lng: 0 },
                },
              }));
              setErrors((prev) => ({ ...prev, headquarters: "" }));
            }}
            error={errors.headquarters}
            style={styles.input}
          />
        </View>

        <View style={styles.visibilityContainer}>
          <Input
            placeholder="Group Visibility"
            value={
              formData.visibility === GroupVisibility.PUBLIC
                ? "Public"
                : "Private"
            }
            icon={formData.visibility === GroupVisibility.PUBLIC ? Globe : Lock}
            onPress={() => {
              setFormData((prev) => ({
                ...prev,
                visibility:
                  prev.visibility === GroupVisibility.PUBLIC
                    ? GroupVisibility.PRIVATE
                    : GroupVisibility.PUBLIC,
              }));
            }}
            editable={false}
            style={styles.input}
          />
          <View style={styles.visibilityInfo}>
            {formData.visibility === GroupVisibility.PUBLIC ? (
              <>
                <Globe size={14} color={COLORS.textSecondary} />
                <Text style={styles.visibilityText}>
                  Anyone can find and join this group
                </Text>
              </>
            ) : (
              <>
                <Lock size={14} color={COLORS.textSecondary} />
                <Text style={styles.visibilityText}>
                  Only invited members can join this group
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  form: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginLeft: 8,
  },
  visibilityContainer: {
    marginBottom: 16,
  },
  visibilityInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 8,
  },
  visibilityText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 8,
  },
});

export default CreateGroupScreen;
