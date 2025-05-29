import AnimatedMapBackground from "@/components/Background";
import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { apiClient } from "@/services/ApiClient";
import { GroupVisibility } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Globe,
  Lock,
  MapPin,
  Tag,
  Users,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import Input from "../Input/Input";
import TextArea from "../Input/TextArea";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import { Select, SelectOption } from "../Select/Select";

// Create a wrapper component that matches the expected icon type
const MapPinIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => <MapPin size={size} color={color} />;

const CreateGroup: React.FC = () => {
  const router = useRouter();
  const { mapStyle } = useMapStyle();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [visibility, setVisibility] = useState<GroupVisibility>(
    GroupVisibility.PUBLIC,
  );
  const [allowMemberEventCreation, setAllowMemberEventCreation] =
    useState(false);
  const [headquarters, setHeadquarters] = useState<SelectOption | undefined>();
  const [searchResults, setSearchResults] = useState<SelectOption[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // Refs for inputs
  const nameInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  // Animation styles
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const handleSearchPlaces = async (query: string) => {
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
      setError("Failed to search cities. Please try again.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      setError("Group name is required");
      nameInputRef.current?.focus();
      return;
    }

    if (!user?.id) {
      setError("You must be logged in to create a group");
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Get the selected headquarters data from the search results
      const selectedHeadquarters = searchResults.find(
        (result) => result.id === headquarters?.id,
      );

      const groupData = {
        name: name.trim(),
        description: description.trim() || undefined,
        emoji: emoji || undefined,
        visibility,
        allowMemberEventCreation,
        categoryIds: [],
        headquarters: selectedHeadquarters
          ? {
              placeId: selectedHeadquarters.id,
              name: selectedHeadquarters.label,
              address: selectedHeadquarters.description || "",
              coordinates: {
                type: "Point" as const,
                coordinates: [0, 0] as [number, number],
              },
            }
          : undefined,
      };

      await apiClient.groups.createGroup(groupData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/groups");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Create group error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to create group. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleCreatePress = async () => {
    if (isLoading) return;

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    // Delay the create action until after animation
    setTimeout(() => {
      Keyboard.dismiss();
      handleCreateGroup();
    }, 150);
  };

  const toggleVisibility = useCallback(() => {
    Haptics.selectionAsync();
    setVisibility((prev: GroupVisibility) =>
      prev === GroupVisibility.PUBLIC
        ? GroupVisibility.PRIVATE
        : GroupVisibility.PUBLIC,
    );
  }, []);

  const toggleMemberEventCreation = useCallback(() => {
    Haptics.selectionAsync();
    setAllowMemberEventCreation((prev) => !prev);
  }, []);

  return (
    <ScreenLayout>
      <SafeAreaView style={styles.container}>
        <AnimatedMapBackground settings={{ styleURL: mapStyle }} />
        <StatusBar barStyle="light-content" backgroundColor="#333" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              entering={FadeInDown.duration(600).delay(100).springify()}
              style={styles.contentContainer}
            >
              <Animated.View
                entering={FadeInDown.duration(600).delay(300).springify()}
                layout={LinearTransition.springify()}
                style={styles.formContainer}
              >
                <Animated.View
                  layout={LinearTransition.springify()}
                  style={styles.formCard}
                >
                  {/* Back Button */}
                  <TouchableOpacity
                    onPress={handleBack}
                    style={styles.backButton}
                  >
                    <ArrowLeft size={20} color={COLORS.textPrimary} />
                  </TouchableOpacity>

                  {/* Header */}
                  <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>Create New Group</Text>
                    <Text style={styles.headerSubtitle}>
                      Start a community around shared interests
                    </Text>
                  </View>

                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* Form Fields */}
                  <View style={styles.formFields}>
                    <Input
                      ref={nameInputRef}
                      placeholder="Group name"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() =>
                        descriptionInputRef.current?.focus()
                      }
                      delay={300}
                    />

                    <TextArea
                      ref={descriptionInputRef}
                      placeholder="Group description (optional)"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={4}
                      delay={400}
                    />

                    <Input
                      placeholder="Group emoji (optional)"
                      value={emoji}
                      onChangeText={setEmoji}
                      maxLength={2}
                      delay={500}
                    />

                    {/* Visibility Toggle */}
                    <TouchableOpacity
                      style={styles.toggleContainer}
                      onPress={toggleVisibility}
                      activeOpacity={0.7}
                    >
                      <View style={styles.toggleIcon}>
                        {visibility === GroupVisibility.PUBLIC ? (
                          <Globe size={18} color={COLORS.accent} />
                        ) : (
                          <Lock size={18} color={COLORS.accent} />
                        )}
                      </View>
                      <View style={styles.toggleTextContainer}>
                        <Text style={styles.toggleLabel}>Group Visibility</Text>
                        <Text style={styles.toggleValue}>
                          {visibility === GroupVisibility.PUBLIC
                            ? "Public"
                            : "Private"}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Member Event Creation Toggle */}
                    <TouchableOpacity
                      style={styles.toggleContainer}
                      onPress={toggleMemberEventCreation}
                      activeOpacity={0.7}
                    >
                      <View style={styles.toggleIcon}>
                        <Users size={18} color={COLORS.accent} />
                      </View>
                      <View style={styles.toggleTextContainer}>
                        <Text style={styles.toggleLabel}>
                          Allow Member Event Creation
                        </Text>
                        <Text style={styles.toggleValue}>
                          {allowMemberEventCreation ? "Enabled" : "Disabled"}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Headquarters Section */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <MapPin size={18} color={COLORS.accent} />
                        <Text style={styles.sectionTitle}>Headquarters</Text>
                      </View>
                      <Select
                        value={headquarters}
                        options={searchResults}
                        placeholder="Search for a city or state..."
                        searchable
                        loading={isSearchingPlaces}
                        onSearch={handleSearchPlaces}
                        onChange={setHeadquarters}
                        onClear={() => setHeadquarters(undefined)}
                      />
                    </View>

                    {/* Categories Section */}
                    <View style={styles.categoriesSection}>
                      <View style={styles.sectionHeader}>
                        <Tag size={18} color={COLORS.accent} />
                        <Text style={styles.sectionTitle}>Categories</Text>
                      </View>
                    </View>

                    {/* Create Button */}
                    <TouchableOpacity
                      onPress={handleCreatePress}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      style={[styles.createButton, buttonAnimatedStyle]}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.createButtonText}>
                          Create Group
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    zIndex: 2,
  },
  formCard: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    position: "relative",
    overflow: "hidden",
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
  headerContainer: {
    marginTop: 40,
    marginBottom: 24,
    alignItems: "center",
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    textAlign: "center",
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  formFields: {
    gap: 16,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    marginBottom: 2,
  },
  toggleValue: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  categoriesSection: {
    marginTop: 8,
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
  categoriesScroll: {
    maxHeight: 100,
  },
  categoriesContainer: {
    paddingRight: 20,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  categoryChipTextSelected: {
    color: COLORS.accent,
    fontWeight: "600",
  },
  createButton: {
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  createButtonText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  section: {
    marginTop: 8,
  },
});

export default CreateGroup;
