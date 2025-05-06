import SwipeableClock from "@/components/Clock/SwipeableClock";
import EmbeddedDateRangeCalendar from "@/components/EmbeddedDateRangeCalendar";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import Header from "@/components/Layout/Header";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import { CheckboxGroup } from "@/components/CheckboxGroup/CheckboxGroup";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Book, List, User } from "lucide-react-native";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { Friend, apiClient } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import EmojiPicker from "@/components/Input/EmojiPicker";
import { formatDate, getUserLocalTime, getUserTimezone } from "@/utils/dateTimeFormatting";
import { formatInTimeZone } from "date-fns-tz";

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

const CreatePrivateEvent = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  // Get coordinates from params
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
  const [date, setDate] = useState(
    params.eventDate ? new Date(params.eventDate as string) : new Date()
  );
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [eventName, setEventName] = useState((params.title as string) || "");
  const [eventDescription, setEventDescription] = useState((params.description as string) || "");
  const [selectedEmoji, setSelectedEmoji] = useState((params.emoji as string) || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const buttonScale = useSharedValue(1);

  // Add effect to initialize selected friends in edit mode
  useEffect(() => {
    const initializeSelectedFriends = async () => {
      if (params.id) {
        try {
          // Get the event details including shares
          const event = await apiClient.getEventById(params.id as string);
          if (event) {
            // Get all friends
            const friends = await apiClient.getFriends();

            // Get the shares for this event
            const shares = await apiClient.getEventShares(params.id as string);

            // Get the IDs of users the event is shared with
            const sharedWithIds = shares.map((share) => share.sharedWithId);

            // Filter friends to only those that are in sharedWithIds
            const selectedFriends = friends.filter((friend) => sharedWithIds.includes(friend.id));
            setSelectedFriends(selectedFriends);

            // Also set other event details if they exist
            if (event.title) setEventName(event.title);
            if (event.description) setEventDescription(event.description);
            if (event.emoji) setSelectedEmoji(event.emoji);
            if (event.eventDate) setDate(new Date(event.eventDate));
            if (
              event.location &&
              typeof event.location === "object" &&
              "coordinates" in event.location
            ) {
              const location = event.location as { coordinates: [number, number] };
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

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
  };

  const handleTitleSubmit = () => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    if (!eventName.trim()) {
      Alert.alert("Error", "Please enter an event name");
      return;
    }

    if (!coordinates) {
      Alert.alert("Error", "Location is required");
      return;
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 })
    );

    setIsSubmitting(true);

    try {
      const eventData = {
        title: eventName.trim(),
        description: eventDescription.trim(),
        emoji: selectedEmoji || "📍", // Use default emoji if none selected
        date: date.toISOString(),
        location: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude] as [number, number],
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
        await apiClient.updateEvent(params.id as string, eventData);
        Alert.alert("Success", "Your private event has been updated.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        // Create new event
        const result = await apiClient.createPrivateEvent(eventData);
        Alert.alert(
          "Success",
          "Your private event is being created. You'll be notified when it's ready.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error with private event:", error);
      Alert.alert("Error", "Failed to process private event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add formatted date display
  const formattedDate = formatDate(date.toISOString());
  const userLocalTime = getUserLocalTime(date.toISOString());

  // Convert date to user's local timezone for display
  const userTimezone = getUserTimezone();
  const localDate = new Date(date);
  localDate.setHours(date.getHours());
  localDate.setMinutes(date.getMinutes());

  return (
    <ScreenLayout>
      <Header
        title={params.title ? "Update Private Event" : "Create Private Event"}
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
              <EmojiPicker value={selectedEmoji} onEmojiSelect={handleEmojiSelect} />
              {!selectedEmoji && (
                <View style={styles.callout}>
                  <Text style={styles.calloutText}>No emoji selected - AI will infer one</Text>
                </View>
              )}
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
              <SwipeableClock date={localDate} onChange={setDate} />
              <View style={styles.dateDisplay}>
                <Text style={styles.dateText}>{formattedDate}</Text>
                {userLocalTime && <Text style={styles.localTimeText}>{userLocalTime}</Text>}
              </View>
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
});

export default CreatePrivateEvent;
