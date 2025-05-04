import { useState, useCallback } from "react";
import { apiClient, type LocationSearchResult } from "@/services/ApiClient";
import type { SelectOption } from "@/components/Input/SelectInput";

interface UseLocationSearchProps {
  userCoordinates?: { lat: number; lng: number };
  minQueryLength?: number;
}

interface UseLocationSearchResult {
  locationOptions: SelectOption[];
  isSearching: boolean;
  searchLocations: (query: string) => Promise<void>;
  selectedLocation: LocationSearchResult | null;
  setSelectedLocation: (location: LocationSearchResult | null) => void;
  getLocationFromCoordinates: (
    lat: number,
    lng: number
  ) => Promise<{
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    formattedAddress: string;
    placeId: string;
    types: string[];
    locationType: string;
  } | null>;
  isGettingLocation: boolean;
}

export const useLocationSearch = ({
  userCoordinates,
  minQueryLength = 2,
}: UseLocationSearchProps = {}): UseLocationSearchResult => {
  const [locationOptions, setLocationOptions] = useState<SelectOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);

  const searchLocations = useCallback(
    async (query: string) => {
      console.log({ query });
      if (query.length < minQueryLength) {
        setLocationOptions([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await apiClient.searchLocations(query, userCoordinates);

        console.log(results);

        // Transform the results into SelectOption format
        const options = results.map((location) => ({
          label: `${location.name} - ${location.address}`,
          value: location.placeId,
        }));

        setLocationOptions(options);
      } catch (error) {
        console.error("Error searching locations:", error);
        setLocationOptions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [userCoordinates, minQueryLength]
  );

  const getLocationFromCoordinates = useCallback(async (lat: number, lng: number) => {
    setIsGettingLocation(true);

    console.log({ lat, lng });
    try {
      const location = await apiClient.getLocationFromCoordinates(lat, lng);
      return location;
    } catch (error) {
      console.error("Error getting location from coordinates:", error);
      return null;
    } finally {
      setIsGettingLocation(false);
    }
  }, []);

  return {
    locationOptions,
    isSearching,
    searchLocations,
    selectedLocation,
    setSelectedLocation,
    getLocationFromCoordinates,
    isGettingLocation,
  };
};
