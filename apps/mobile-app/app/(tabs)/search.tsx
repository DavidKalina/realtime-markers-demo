import CategoryBadges from "@/components/CategoryBadges";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API_URL = "https://c8b6-69-162-231-94.ngrok-free.app/api/events";

const SearchScreen = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [locationPermission, setLocationPermission] = useState<any>(null);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
    checkLocationPermission();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status);
    if (status === "granted") {
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      let url = `${API_URL}/search?q=${encodeURIComponent(searchQuery)}`;
      if (selectedCategories.length > 0) {
        url += `&categories=${selectedCategories.join(",")}`;
      }
      const response = await fetch(url);
      const data = await response.json();

      console.log(response);
      setSearchResults(data.results);
    } catch (error) {
      console.error("Error searching events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNearbySearch = async () => {
    if (!userLocation) return;

    setIsLoading(true);
    try {
      const { latitude, longitude } = userLocation.coords;
      const response = await fetch(
        `api/events/nearby?lat=${latitude}&lng=${longitude}&radius=10000`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error fetching nearby events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search-outline" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          placeholderTextColor="#666"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filters */}
      <CategoryBadges
        categories={categories}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        containerStyle={styles.categoryContainer}
      />

      {/* Results */}
      <ScrollView style={styles.resultsContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          searchResults?.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/results?eventId=${event.id}`)}
            >
              <Text style={styles.eventEmoji}>{event.emoji}</Text>
              <View style={styles.eventDetails}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDate}>
                  {new Date(event.eventDate).toLocaleDateString()}
                </Text>
                <Text style={styles.eventLocation} numberOfLines={1}>
                  📍 {event.address}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f5f5f5",
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#333",
  },
  categoryContainer: {
    marginBottom: 16,
  },

  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  eventCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: "#666",
  },
});

export default SearchScreen;
