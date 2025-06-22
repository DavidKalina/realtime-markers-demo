"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  MapPin,
  Clock,
  User,
  Filter,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiService,
  type CivicEngagement,
  type CivicEngagementStats,
} from "@/services/api";

export default function CivicEngagementsPage() {
  const { user } = useAuth();
  const [civicEngagements, setCivicEngagements] = useState<CivicEngagement[]>(
    [],
  );
  const [stats, setStats] = useState<CivicEngagementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState("map");

  // WebSocket URL for real-time updates
  const websocketUrl =
    process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3002";

  // Default center (you can adjust this to your city's coordinates)
  const defaultCenter: [number, number] = [-77.0369, 38.9072]; // Washington DC
  const defaultZoom = 10;

  // Fetch civic engagements
  const fetchCivicEngagements = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCivicEngagements();

      if (response.data) {
        setCivicEngagements(response.data.civicEngagements || []);
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
        },
        (error) => {
          console.error("Error getting location:", error);
        },
      );
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
                Civic Engagements
              </h2>
              <p className="text-muted-foreground mt-2">
                Monitor and manage community feedback and requests
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  fetchCivicEngagements();
                  fetchStats();
                }}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Engagement
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
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

          {/* Main Content Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Map View
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                List View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Interactive Map</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[600px] w-full">
                    <InteractiveMap
                      websocketUrl={websocketUrl}
                      initialCenter={userLocation || defaultCenter}
                      initialZoom={defaultZoom}
                      userLocation={userLocation}
                      onLocationUpdate={setUserLocation}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
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
