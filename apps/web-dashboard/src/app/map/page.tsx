"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Filter,
  Layers,
  Users,
  Calendar,
  Map,
  Navigation,
} from "lucide-react";
import { useLocationStore } from "@/stores/useLocationStoreWeb";

export default function MapPage() {
  const { markers } = useLocationStore();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    -74.006, 40.7128,
  ]); // NYC default
  const [mapZoom, setMapZoom] = useState(12);

  // WebSocket URL - you'll need to configure this based on your environment
  const websocketUrl =
    process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3001";

  // Get user location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            setUserLocation([longitude, latitude]);
            setMapCenter([longitude, latitude]);
          },
          (error) => {
            console.log("Geolocation error:", error);
            // Keep default NYC coordinates
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          },
        );
      }
    };

    getUserLocation();
  }, []);

  // Manual location trigger function
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          setMapCenter([longitude, latitude]);
          setMapZoom(14); // Zoom in closer when user sets their location
          alert(
            `Location updated! Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
          );
        },
        (error) => {
          console.log("Geolocation error:", error);
          let errorMessage = "Unable to get your location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location permission denied. Please allow location access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
          }
          alert(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        },
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Map View</h2>
              <p className="text-muted-foreground">
                Interactive map with real-time event locations
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Layers className="h-4 w-4 mr-2" />
                Layers
              </Button>
            </div>
          </div>

          {/* Interactive Map */}
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Event Map
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

          {/* Map Statistics */}
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

          {/* Map Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Use the Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">Navigation</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Drag to pan around the map</li>
                    <li>• Use scroll wheel to zoom in/out</li>
                    <li>• Click on markers to view event details</li>
                    <li>• Use the navigation controls in the top-right</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Real-time Updates</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Events update automatically via WebSocket</li>
                    <li>• Connection status shown in top-left</li>
                    <li>• New events appear as you move the map</li>
                    <li>• Click "Reset View" to return to default position</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
