import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptySearchStateProps {
  searchQuery: string;
  hasFilters: boolean;
  onClearFilters: () => void;
}

const EmptySearchState = ({ searchQuery, hasFilters, onClearFilters }: EmptySearchStateProps) => {
  // Determine what message to show based on whether this is a search or filter result
  const getMessage = () => {
    if (searchQuery.trim()) {
      return {
        title: "No results found",
        description: `We couldn't find any events matching "${searchQuery}"${
          hasFilters ? " with the selected filters" : ""
        }.`,
        icon: "search-outline",
      };
    } else if (hasFilters) {
      return {
        title: "No events in these categories",
        description: "We couldn't find any events matching the selected categories.",
        icon: "filter-outline",
      };
    } else {
      return {
        title: "No events found",
        description: "There are no upcoming events to display.",
        icon: "calendar-outline",
      };
    }
  };

  const message = getMessage();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={message.icon as unknown as any} size={64} color="#555" />
      </View>

      <Text style={styles.title}>{message.title}</Text>
      <Text style={styles.description}>{message.description}</Text>

      {/* Show suggestion or action based on context */}
      {(searchQuery.trim() || hasFilters) && (
        <View style={styles.actionContainer}>
          {hasFilters && (
            <TouchableOpacity style={styles.actionButton} onPress={onClearFilters}>
              <Ionicons name="close-circle-outline" size={20} color="#3498db" />
              <Text style={styles.actionText}>Clear filters</Text>
            </TouchableOpacity>
          )}

          {searchQuery.trim() && (
            <View style={styles.suggestionContainer}>
              <Text style={styles.suggestionText}>Try:</Text>
              <Text style={styles.suggestionItem}>• Using more general keywords</Text>
              <Text style={styles.suggestionItem}>• Checking for typos</Text>
              {hasFilters && <Text style={styles.suggestionItem}>• Removing some filters</Text>}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  actionContainer: {
    width: "100%",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 152, 219, 0.15)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  actionText: {
    color: "#3498db",
    fontWeight: "600",
    marginLeft: 8,
  },
  suggestionContainer: {
    width: "100%",
    alignItems: "flex-start",
  },
  suggestionText: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 8,
  },
  suggestionItem: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default EmptySearchState;
