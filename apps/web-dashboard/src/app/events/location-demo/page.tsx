"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LocationSearch } from "@/components/dashboard/LocationSearch";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LocationDemoPage() {
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    locationNotes?: string;
  } | null>(null);

  const [userCoordinates, setUserCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Get user's current location
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserCoordinates({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            console.log("Geolocation error:", error);
            // Fallback to a more neutral location (New York City)
            setUserCoordinates({
              lat: 40.7128,
              lng: -74.006,
            });
          },
        );
      } else {
        console.log("Geolocation not supported");
        // Fallback to a more neutral location (New York City)
        setUserCoordinates({
          lat: 40.7128,
          lng: -74.006,
        });
      }
    };

    getUserLocation();
  }, []);

  const handleLocationSelect = (location: {
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    locationNotes?: string;
  }) => {
    setSelectedLocation(location);
    console.log("Selected location:", location);
  };

  const handleLocationClear = () => {
    setSelectedLocation(null);
    console.log("Location cleared");
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Location Search Demo
            </h1>
            <p className="text-muted-foreground">
              Test the place search functionality
            </p>
          </div>

          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Location Search Component</CardTitle>
              </CardHeader>
              <CardContent>
                <LocationSearch
                  onLocationSelect={handleLocationSelect}
                  onLocationClear={handleLocationClear}
                  selectedLocation={selectedLocation}
                  userCoordinates={userCoordinates || undefined}
                  placeholder="Try searching for 'Starbucks', 'Central Park', or 'Times Square'..."
                />
              </CardContent>
            </Card>

            {selectedLocation && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Selected Location Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <strong>Name:</strong> {selectedLocation.name}
                    </div>
                    <div>
                      <strong>Address:</strong> {selectedLocation.address}
                    </div>
                    <div>
                      <strong>Coordinates:</strong>{" "}
                      {selectedLocation.coordinates.join(", ")}
                    </div>
                    <div>
                      <strong>Place ID:</strong> {selectedLocation.placeId}
                    </div>
                    {selectedLocation.locationNotes && (
                      <div>
                        <strong>Location Notes:</strong>{" "}
                        {selectedLocation.locationNotes}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
