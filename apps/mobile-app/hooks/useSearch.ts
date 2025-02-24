import { useState, useEffect } from "react";
import * as Location from "expo-location";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const useSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(
    null
  );

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

      setSearchResults(data.results);
    } catch (error) {
      console.error("Error searching events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  return {
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategories,
    searchResults,
    isLoading,
    userLocation,
    locationPermission,
    handleSearch,
    toggleCategory,
  };
};

export default useSearch;
