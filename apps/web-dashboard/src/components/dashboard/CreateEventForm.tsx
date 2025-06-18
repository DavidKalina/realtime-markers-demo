"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, MapPin, Users, Clock, Globe, Lock } from "lucide-react";
import { apiService, type CreateEventPayload } from "@/services/api";
import { LocationSearch } from "./LocationSearch";
import { EmojiPicker } from "./EmojiPicker";

interface CreateEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: {
    title?: string;
    description?: string;
    date?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
}

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  isPrivate: boolean;
  emoji?: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  sharedWithIds: string[];
  locationNotes: string;
}

interface Friend {
  id: string;
  name: string;
  email: string;
}

interface SelectedLocation {
  name: string;
  address: string;
  coordinates: [number, number];
  placeId: string;
  locationNotes?: string;
}

export function CreateEventForm({
  onSuccess,
  onCancel,
  initialData,
}: CreateEventFormProps) {
  const [formData, setFormData] = useState<EventFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    date: initialData?.date || new Date().toISOString().split("T")[0],
    time: new Date().toISOString().split("T")[1].substring(0, 5),
    isPrivate: false,
    emoji: undefined,
    location: {
      latitude: initialData?.location?.latitude || 0,
      longitude: initialData?.location?.longitude || 0,
      address: initialData?.location?.address || "",
    },
    sharedWithIds: [],
    locationNotes: "",
  });

  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  // Fetch friends data
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await apiService.getFriends();
        if (response.data) {
          setFriends(response.data);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
        // Fallback to mock data if API fails
        setFriends([
          { id: "1", name: "John Doe", email: "john@example.com" },
          { id: "2", name: "Jane Smith", email: "jane@example.com" },
          { id: "3", name: "Bob Johnson", email: "bob@example.com" },
        ]);
      }
    };

    fetchFriends();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Event title is required";
    }

    if (!formData.date) {
      newErrors.date = "Event date is required";
    }

    if (!formData.time) {
      newErrors.time = "Event time is required";
    }

    // Check if event is at least 15 minutes in the future
    const eventDateTime = new Date(`${formData.date}T${formData.time}`);
    const now = new Date();
    const minDateTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

    if (eventDateTime <= minDateTime) {
      newErrors.date =
        "Event must be scheduled at least 15 minutes in the future";
    }

    if (formData.isPrivate && formData.sharedWithIds.length === 0) {
      newErrors.sharedWithIds = "Please select at least one friend to invite";
    }

    // Check if location is selected
    if (!selectedLocation) {
      newErrors.location = "Please select a location for your event";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const eventDateTime = new Date(`${formData.date}T${formData.time}`);

      const eventPayload: CreateEventPayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        date: eventDateTime.toISOString(),
        eventDate: eventDateTime.toISOString(),
        isPrivate: formData.isPrivate,
        emoji: formData.emoji,
        location: {
          type: "Point",
          coordinates: selectedLocation ? selectedLocation.coordinates : [0, 0],
        },
        address: selectedLocation?.address || "",
        locationNotes:
          selectedLocation?.locationNotes || formData.locationNotes,
        sharedWithIds: formData.isPrivate ? formData.sharedWithIds : [],
        userCoordinates: userCoordinates || undefined,
      };

      let response;
      if (formData.isPrivate) {
        response = await apiService.createPrivateEvent(eventPayload);
      } else {
        response = await apiService.createEvent(eventPayload);
      }

      if (response.error) {
        throw new Error(response.error);
      }

      if (formData.isPrivate && response.data && "jobId" in response.data) {
        // Private events return job status
        alert(`Event creation started! Job ID: ${response.data.jobId}`);
      } else {
        // Public events return the created event
        alert("Event created successfully!");
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error creating event:", error);
      alert(
        `Failed to create event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
    // Clear location error when location is selected
    if (errors.location) {
      setErrors((prev) => ({
        ...prev,
        location: "",
      }));
    }
  };

  const handleLocationClear = () => {
    setSelectedLocation(null);
  };

  const toggleFriendSelection = (friendId: string) => {
    setFormData((prev) => ({
      ...prev,
      sharedWithIds: prev.sharedWithIds.includes(friendId)
        ? prev.sharedWithIds.filter((id) => id !== friendId)
        : [...prev.sharedWithIds, friendId],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Event
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Type Selection */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Event Type</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={!formData.isPrivate ? "default" : "outline"}
                  onClick={() => handleInputChange("isPrivate", false)}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Public Event
                </Button>
                <Button
                  type="button"
                  variant={formData.isPrivate ? "default" : "outline"}
                  onClick={() => handleInputChange("isPrivate", true)}
                  className="flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Private Event
                </Button>
              </div>
            </div>

            {/* Event Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Enter event title"
                  className={errors.title ? "border-red-500" : ""}
                />
                {errors.title && (
                  <p className="text-sm text-red-500 mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <Label>Event Emoji</Label>
                <div className="flex items-center gap-2">
                  <EmojiPicker
                    selectedEmoji={formData.emoji}
                    onEmojiSelect={(emoji) => handleInputChange("emoji", emoji)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Choose an emoji to represent your event
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Describe your event..."
                  rows={3}
                />
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className={errors.date ? "border-red-500" : ""}
                />
                {errors.date && (
                  <p className="text-sm text-red-500 mt-1">{errors.date}</p>
                )}
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                  className={errors.time ? "border-red-500" : ""}
                />
                {errors.time && (
                  <p className="text-sm text-red-500 mt-1">{errors.time}</p>
                )}
              </div>
            </div>

            {/* Location Search */}
            <div className="space-y-4">
              <LocationSearch
                onLocationSelect={handleLocationSelect}
                onLocationClear={handleLocationClear}
                selectedLocation={selectedLocation}
                userCoordinates={userCoordinates || undefined}
                placeholder="Search for a venue, restaurant, or location..."
              />
              {errors.location && (
                <p className="text-sm text-red-500">{errors.location}</p>
              )}

              {/* Additional Location Notes */}
              <div>
                <Label htmlFor="locationNotes">
                  Additional Location Details
                </Label>
                <Textarea
                  id="locationNotes"
                  value={formData.locationNotes}
                  onChange={(e) =>
                    handleInputChange("locationNotes", e.target.value)
                  }
                  placeholder="Room number, floor, entrance details, etc."
                  rows={2}
                />
              </div>
            </div>

            {/* Friends Selection (for private events) */}
            {formData.isPrivate && (
              <div className="space-y-4">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Invite Friends
                </Label>

                <div className="grid gap-2 max-h-40 overflow-y-auto border rounded-md p-4">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center space-x-2 cursor-pointer"
                      onClick={() => toggleFriendSelection(friend.id)}
                    >
                      <Checkbox
                        checked={formData.sharedWithIds.includes(friend.id)}
                        onCheckedChange={() => toggleFriendSelection(friend.id)}
                      />
                      <div>
                        <p className="font-medium">{friend.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {friend.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {errors.sharedWithIds && (
                  <p className="text-sm text-red-500">{errors.sharedWithIds}</p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </div>
                ) : (
                  `Create ${formData.isPrivate ? "Private" : "Public"} Event`
                )}
              </Button>

              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
