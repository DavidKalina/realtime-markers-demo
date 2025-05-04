import Header from "@/components/Layout/Header";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from "react-native";
import React, { useState, useCallback } from "react";
import Input from "@/components/Input/Input";
import TextArea from "@/components/Input/TextArea";
import DateTimeSelector from "@/components/DateTimeSelector";
import SelectInput from "@/components/Input/SelectInput";
import MultiSelectInput from "@/components/Input/MultiSelectInput";
import { MapPin, Users } from "lucide-react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";

// Dummy location data
const LOCATION_OPTIONS = [
  { label: "New York City, NY", value: "nyc" },
  { label: "Los Angeles, CA", value: "la" },
  { label: "Chicago, IL", value: "chi" },
  { label: "Miami, FL", value: "mia" },
  { label: "Seattle, WA", value: "sea" },
  { label: "Austin, TX", value: "aus" },
  { label: "Denver, CO", value: "den" },
  { label: "Boston, MA", value: "bos" },
  { label: "San Francisco, CA", value: "sf" },
  { label: "Portland, OR", value: "pdx" },
];

// Dummy friends data
const FRIEND_OPTIONS = [
  { label: "John Smith", value: "john" },
  { label: "Sarah Johnson", value: "sarah" },
  { label: "Michael Brown", value: "michael" },
  { label: "Emily Davis", value: "emily" },
  { label: "David Wilson", value: "david" },
  { label: "Lisa Anderson", value: "lisa" },
  { label: "James Taylor", value: "james" },
  { label: "Emma Martinez", value: "emma" },
  { label: "Robert Garcia", value: "robert" },
  { label: "Sophia Lee", value: "sophia" },
];

const CreatePrivateEvent = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [friends, setFriends] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateRangeSelect = useCallback((start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const handleSubmit = async () => {
    if (!title || !startDate || !endDate || !location || friends.length === 0) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement event creation
      console.log({
        title,
        description,
        startDate,
        endDate,
        location,
        friends,
      });
    } catch (error) {
      console.error("Error creating event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            options={LOCATION_OPTIONS}
            value={location}
            onChange={setLocation}
            placeholder="Select a location"
            delay={300}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Friends</Text>
          <MultiSelectInput
            icon={Users}
            options={FRIEND_OPTIONS}
            values={friends}
            onChange={setFriends}
            placeholder="Select friends to invite"
            maxSelections={10}
            delay={400}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range</Text>
          <DateTimeSelector
            startDate={startDate || undefined}
            endDate={endDate || undefined}
            onDateRangeSelect={handleDateRangeSelect}
            isLoading={isSubmitting}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!title || !startDate || !endDate || !location || friends.length === 0) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={
            !title || !startDate || !endDate || !location || friends.length === 0 || isSubmitting
          }
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
});

export default CreatePrivateEvent;
