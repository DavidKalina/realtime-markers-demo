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
} from "react-native";
import { Friend } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import Animated, {
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

const CreatePrivateEvent = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
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

  const [date, setDate] = useState(new Date("2025-07-23T06:49:00.000Z"));
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 })
    );

    // Delay the submit action until after animation
    setTimeout(() => {
      setIsSubmitting(true);
      // TODO: Add your submit logic here
      console.log("Submitting event:", {
        eventName,
        eventDescription,
        date,
        selectedFriends,
        coordinates,
      });
      setIsSubmitting(false);
    }, 150);
  };

  console.log("DATE", date);
  console.log("Hours:", date.getHours());
  console.log("Minutes:", date.getMinutes());

  return (
    <ScreenLayout>
      <Header title="Create Private Event" onBack={() => router.back()} />
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
                placeholder="Event Name"
                icon={Book}
                value={eventName}
                onChangeText={setEventName}
              />
              <TextArea
                placeholder="Event Description"
                icon={List}
                value={eventDescription}
                onChangeText={setEventDescription}
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
              <SwipeableClock date={date} onChange={setDate} />
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
                  <Text style={styles.submitButtonText}>Create Event</Text>
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
});

export default CreatePrivateEvent;
