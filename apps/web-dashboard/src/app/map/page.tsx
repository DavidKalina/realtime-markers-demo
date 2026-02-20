"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocationStore } from "@/stores/useLocationStoreWeb";
import {
  Calendar,
  Layers,
  MapPin,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function MapPage() {
  const { markers } = useLocationStore();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    -74.006, 40.7128,
  ]); // NYC default
  const [mapZoom] = useState(12);

  // WebSocket URL for real-time updates
  const websocketUrl =
    process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3001";

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          setMapCenter([longitude, latitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    }
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Interactive Map
              </h2>
              <p className="text-muted-foreground mt-2">
                View events on an interactive map in real time
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={getUserLocation}>
                <MapPin className="h-4 w-4 mr-2" />
                My Location
              </Button>
              <Button variant="outline">
                <Layers className="h-4 w-4 mr-2" />
                Layers
              </Button>
            </div>
          </div>

          {/* Events Map */}
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Events Map
                {userLocation && (
                  <span className="text-sm text-muted-foreground font-normal">
                    📍 Your location: {userLocation[1].toFixed(4)},{" "}
                    {userLocation[0].toFixed(4)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full p-0">
              <InteractiveMap
                websocketUrl={websocketUrl}
                className="h-full"
                initialCenter={mapCenter}
                initialZoom={mapZoom}
                userLocation={userLocation}
                onLocationUpdate={setUserLocation}
              />
            </CardContent>
          </Card>

          {/* Events Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{markers.length}</div>
                <p className="text-muted-foreground">Currently visible</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Total Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {markers.filter((m) => m.data.location).length}
                </div>
                <p className="text-muted-foreground">Event venues</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {
                    markers.filter((m) => {
                      if (!m.data.eventDate) return false;
                      const eventDate = new Date(m.data.eventDate);
                      const now = new Date();
                      return eventDate > now;
                    }).length
                  }
                </div>
                <p className="text-muted-foreground">Scheduled events</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
