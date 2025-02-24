import React from "react";
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery, handleSearch }) => {
  return (
    <View style={styles.searchBarContainer}>
      <Ionicons name="search-outline" size={20} color="#69db7c" />
      <TextInput
        style={styles.searchInput}
        placeholder="Search events..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
        placeholderTextColor="#666"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color="#69db7c" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#444",
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#555",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#FFF",
    fontFamily: "SpaceMono",
    paddingVertical: 3,
  },
  clearButton: {
    padding: 4, // Make the touch target slightly larger
  },
});

export default SearchBar;
