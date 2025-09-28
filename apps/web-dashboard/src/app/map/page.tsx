"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiService, type CivicEngagementStats } from "@/services/api";
import { useLocationStore } from "@/stores/useLocationStoreWeb";
import type { CivicEngagement } from "@realtime-markers/database";
import {
  Calendar,
  Clock,
  Filter,
  Layers,
  MapPin,
  MessageSquare,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function MapPage() {
  const { markers } = useLocationStore();
  const [civicEngagements, setCivicEngagements] = useState<CivicEngagement[]>(
    [],
  );
  const [stats, setStats] = useState<CivicEngagementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState("events");
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    -74.006, 40.7128,
  ]); // NYC default
  const [mapZoom, setMapZoom] = useState(12);

  // WebSocket URL for real-time updates
  const websocketUrl =
    process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3001";

  // Default center for civic engagements (Washington DC)
  const defaultCivicCenter: [number, number] = [-77.0369, 38.9072];
  const defaultCivicZoom = 10;

  // Fetch civic engagements
  const fetchCivicEngagements = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCivicEngagements();

      if (response.data) {
        setCivicEngagements(
          (response.data.civicEngagements as CivicEngagement[]) || [],
        );
      }
    } catch (error) {
      console.error("Error fetching civic engagements:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await apiService.getCivicEngagementStats();

      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          if (activeTab === "events") {
            setMapCenter([longitude, latitude]);
          }
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

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "events") {
      setMapCenter(userLocation || [-74.006, 40.7128]);
      setMapZoom(12);
    } else if (value === "civic") {
      setMapCenter(userLocation || defaultCivicCenter);
      setMapZoom(defaultCivicZoom);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchCivicEngagements();
    fetchStats();
    getUserLocation();
  }, []);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "IN_REVIEW":
        return "bg-blue-100 text-blue-800";
      case "APPROVED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "IMPLEMENTED":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case "SUGGESTION":
        return "bg-green-100 text-green-800";
      case "COMPLAINT":
        return "bg-red-100 text-red-800";
      case "QUESTION":
        return "bg-blue-100 text-blue-800";
      case "COMPLIMENT":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
                View events and civic engagements on an interactive map
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (activeTab === "civic") {
                    fetchCivicEngagements();
                    fetchStats();
                  }
                }}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button variant="outline">
                <Layers className="h-4 w-4 mr-2" />
                Layers
              </Button>
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Events
              </TabsTrigger>
              <TabsTrigger value="civic" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Civic Engagements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="space-y-4">
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
            </TabsContent>

            <TabsContent value="civic" className="space-y-4">
              {/* Civic Engagements Stats */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total
                      </CardTitle>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Pending
                      </CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.byStatus.PENDING || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        In Review
                      </CardTitle>
                      <Filter className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.byStatus.IN_REVIEW || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Implemented
                      </CardTitle>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.byStatus.IMPLEMENTED || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Civic Engagements Map */}
              <Card>
                <CardHeader>
                  <CardTitle>Civic Engagements Map</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[600px] w-full">
                    <InteractiveMap
                      websocketUrl={websocketUrl}
                      initialCenter={userLocation || defaultCivicCenter}
                      initialZoom={defaultCivicZoom}
                      userLocation={userLocation}
                      onLocationUpdate={setUserLocation}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Civic Engagements List */}
              <Card>
                <CardHeader>
                  <CardTitle>All Civic Engagements</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-600">Loading...</span>
                    </div>
                  ) : civicEngagements.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        No civic engagements found
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {civicEngagements.map((engagement) => (
                        <div
                          key={engagement.id}
                          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">
                                {engagement.title}
                              </h3>
                              {engagement.description && (
                                <p className="text-gray-600 mt-1">
                                  {engagement.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  className={getTypeColor(engagement.type)}
                                >
                                  {engagement.type}
                                </Badge>
                                <Badge
                                  className={getStatusColor(engagement.status)}
                                >
                                  {engagement.status}
                                </Badge>
                                {engagement.address && (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {engagement.address}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {engagement.creatorId}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {new Date(
                                  engagement.createdAt,
                                ).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
