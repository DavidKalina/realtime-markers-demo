"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LocationSearch } from "@/components/dashboard/LocationSearch";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LocationDemoPage() {
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    locationNotes?: string;
  } | null>(null);

  // Mock user coordinates - in a real app, this would come from geolocation
  const userCoordinates = {
    lat: 37.7749, // San Francisco
    lng: -122.4194,
  };

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
                  userCoordinates={userCoordinates}
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
