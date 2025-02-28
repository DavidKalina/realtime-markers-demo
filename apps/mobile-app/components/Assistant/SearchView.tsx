import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { SearchIcon, X, Filter, Calendar, MapPin } from "lucide-react-native";
import { styles } from "./styles";
import { EventType } from "./types";
import { eventSuggestions } from "./data";

interface SearchViewProps {
  onClose: () => void;
  onSelectEvent: (event: EventType) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onClose, onSelectEvent }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filters = [
    { id: "music", name: "Music" },
    { id: "food", name: "Food" },
    { id: "art", name: "Art" },
    { id: "sports", name: "Sports" },
    { id: "charity", name: "Charity" },
  ];

  const filteredEvents = eventSuggestions.filter((event) => {
    const matchesSearch =
      searchQuery === "" ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === null ||
      event.categories.some((cat) => cat.toLowerCase() === activeFilter.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayHeader}>
        <Text style={styles.overlayTitle}>Search Events</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={16} color="#fcd34d" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchInputContainer}>
        <SearchIcon size={16} color="#93c5fd" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, venues, categories..."
          placeholderTextColor="#4b5563"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== "" && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <X size={14} color="#93c5fd" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterChip, activeFilter === filter.id && styles.activeFilterChip]}
            onPress={() => setActiveFilter(activeFilter === filter.id ? null : filter.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter.id && styles.activeFilterChipText,
              ]}
            >
              {filter.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultsText}>
        {filteredEvents.length} {filteredEvents.length === 1 ? "result" : "results"} found
      </Text>

      <ScrollView style={styles.searchResults}>
        {filteredEvents.map((event, index) => (
          <TouchableOpacity
            key={index}
            style={styles.searchResultItem}
            onPress={() => {
              onSelectEvent(event);
              onClose();
            }}
          >
            <Text style={styles.resultEmoji}>{event.emoji}</Text>
            <View style={styles.resultTextContainer}>
              <Text style={styles.resultTitle}>{event.title}</Text>
              <View style={styles.resultDetailsRow}>
                <Calendar size={12} color="#93c5fd" style={styles.smallIcon} />
                <Text style={styles.resultDetailText}>{event.time}</Text>
                <MapPin size={12} color="#93c5fd" style={[styles.smallIcon, { marginLeft: 8 }]} />
                <Text style={styles.resultDetailText}>{event.distance}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};
