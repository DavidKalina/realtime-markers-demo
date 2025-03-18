import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Bookmark, BookmarkCheck, CheckCircle } from "lucide-react-native";

const styles = StyleSheet.create({
  // Main container with enhanced styling
  eventHeaderContainer: {
    flexDirection: "row",
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    padding: 0,
    marginVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },

  // Content container with proper padding
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    width: "100%",
  },

  // Background gradient for visual interest
  headerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  // Emoji container styling
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    marginRight: 16,
  },

  resultEmoji: {
    fontSize: 24,
  },

  // Title area styling
  eventTitleWrapper: {
    flex: 1,
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 5,
  },

  // Verified badge with improved styling
  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(64, 192, 87, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(64, 192, 87, 0.3)",
  },

  statusText: {
    color: "#40c057",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },

  // Save button styling
  saveButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },

  // Animation styling for the save button
  saveButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
});

const EventDetailsHeader = ({
  event,
  savingState,
  handleToggleSave,
  isSaved,
}: {
  event: any;
  isSaved: boolean;
  savingState: "idle" | "loading";
  handleToggleSave: () => void;
}) => {
  return (
    <View style={styles.eventHeaderContainer}>
      <View style={styles.headerContent}>
        <View style={styles.emojiContainer}>
          <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
        </View>

        <View style={styles.eventTitleWrapper}>
          <Text style={styles.resultTitle}>{event.title}</Text>
          {event.verified && (
            <View style={styles.statusBadge}>
              <CheckCircle size={12} color="#40c057" />
              <Text style={styles.statusText}>VERIFIED</Text>
            </View>
          )}
        </View>

        {/* Save Button with improved styling */}
        <TouchableOpacity
          style={[styles.saveButton, savingState === "loading" && { opacity: 0.7 }]}
          onPress={handleToggleSave}
          disabled={savingState === "loading"}
          activeOpacity={0.7}
        >
          {savingState === "loading" ? (
            <ActivityIndicator size="small" color="#93c5fd" />
          ) : isSaved ? (
            <BookmarkCheck size={24} color="#93c5fd" />
          ) : (
            <Bookmark size={24} color="#93c5fd" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default React.memo(EventDetailsHeader);
