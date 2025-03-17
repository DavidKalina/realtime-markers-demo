import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { styles } from "./styles";
import { Bookmark, BookmarkCheck } from "lucide-react-native";

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
      <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
      <View style={styles.eventTitleWrapper}>
        <Text style={styles.resultTitle}>{event.title}</Text>
        {event.verified && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>VERIFIED</Text>
          </View>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleToggleSave}
        disabled={savingState === "loading"}
      >
        {savingState === "loading" ? (
          <ActivityIndicator size="small" color="#93c5fd" />
        ) : isSaved ? (
          <BookmarkCheck size={22} color="#93c5fd" />
        ) : (
          <Bookmark size={22} color="#93c5fd" />
        )}
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(EventDetailsHeader);
