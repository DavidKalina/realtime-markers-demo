"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiService, type PlaceSearchResult } from "@/services/api";
import { MapPin, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface LocationSearchProps {
  onLocationSelect: (location: {
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    locationNotes?: string;
  }) => void;
  onLocationClear: () => void;
  selectedLocation?: {
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    locationNotes?: string;
  } | null;
  userCoordinates?: {
    lat: number;
    lng: number;
  };
  placeholder?: string;
  className?: string;
}

export function LocationSearch({
  onLocationSelect,
  onLocationClear,
  selectedLocation,
  userCoordinates,
  placeholder = "Search for a place...",
  className = "",
}: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    PlaceSearchResult["place"][]
  >([]);
  const [error, setError] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setError("");
        return;
      }

      setIsSearching(true);
      setError("");

      try {
        const response = await apiService.searchPlace({
          query: query.trim(),
          coordinates: userCoordinates,
        });

        if (response.error) {
          setError(response.error);
          setSearchResults([]);
        } else if (response.data?.place) {
          setSearchResults([response.data.place]);
        } else {
          setSearchResults([]);
          setError("No places found matching your search");
        }
      } catch (error) {
        console.error("Error searching places:", error);
        setError("Failed to search places. Please try again.");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [userCoordinates],
  );

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowResults(true);
    debouncedSearch(value);
  };

  // Handle location selection
  const handleLocationSelect = (place: PlaceSearchResult["place"]) => {
    if (place) {
      onLocationSelect({
        name: place.name,
        address: place.address,
        coordinates: place.coordinates,
        placeId: place.placeId,
        locationNotes: place.locationNotes,
      });
      setSearchQuery(place.name);
      setShowResults(false);
      setError("");
    }
  };

  // Handle location clear
  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    setError("");
    setShowResults(false);
    onLocationClear();
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".location-search-container")) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`location-search-container relative ${className}`}>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location
        </Label>

        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={placeholder}
              className="pl-10 pr-10"
              disabled={isSearching}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search Results */}
          {showResults &&
            (searchResults.length > 0 || error || isSearching) && (
              <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto">
                <CardContent className="p-0">
                  {isSearching && (
                    <div className="p-4 text-center text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
                      Searching...
                    </div>
                  )}

                  {error && !isSearching && (
                    <div className="p-4 text-center text-red-500">{error}</div>
                  )}

                  {searchResults.length > 0 && !isSearching && (
                    <div className="divide-y">
                      {searchResults.map((place, index) => (
                        <div
                          key={place?.placeId || index}
                          className="p-4 hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => place && handleLocationSelect(place)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-foreground truncate">
                                {place?.name}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {place?.address}
                              </p>

                              {/* Place details */}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {place?.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    <span>{place.rating}</span>
                                    {place.userRatingsTotal && (
                                      <span>({place.userRatingsTotal})</span>
                                    )}
                                  </div>
                                )}

                                {place?.distance && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>
                                      {place.distance.toFixed(1)} km away
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Place types */}
                              {place?.types && place.types.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {place.types
                                    .slice(0, 3)
                                    .map((type, typeIndex) => (
                                      <Badge
                                        key={typeIndex}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {type.replace(/_/g, " ")}
                                      </Badge>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
        </div>

        {/* Selected Location Display */}
        {selectedLocation && (
          <Card className="mt-4 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-green-900">
                    {selectedLocation.name}
                  </h4>
                  <p className="text-sm text-green-700 mt-1">
                    {selectedLocation.address}
                  </p>
                  {selectedLocation.locationNotes && (
                    <p className="text-xs text-green-600 mt-2">
                      {selectedLocation.locationNotes}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
