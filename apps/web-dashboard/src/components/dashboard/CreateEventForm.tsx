"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  formData: EventFormData;
  onFormDataChange: (formData: EventFormData) => void;
  selectedLocation: SelectedLocation | null;
  onLocationSelect: (location: SelectedLocation) => void;
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
  image?: File;
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
  formData,
  onFormDataChange,
  selectedLocation,
  onLocationSelect,
  initialData,
}: CreateEventFormProps) {
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

  // Manual location trigger function
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoordinates({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          alert(
            `Location updated! Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`,
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
        image: formData.image,
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
    const updatedFormData = {
      ...formData,
      [field]: value,
    };
    onFormDataChange(updatedFormData);

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    onLocationSelect(location);
    // Clear location error when location is selected
    if (errors.location) {
      setErrors((prev) => ({
        ...prev,
        location: "",
      }));
    }
  };

  const handleLocationClear = () => {
    onLocationSelect(null as any);
  };

  const toggleFriendSelection = (friendId: string) => {
    const updatedFormData = {
      ...formData,
      sharedWithIds: formData.sharedWithIds.includes(friendId)
        ? formData.sharedWithIds.filter((id: string) => id !== friendId)
        : [...formData.sharedWithIds, friendId],
    };
    onFormDataChange(updatedFormData);
  };

  return (
    <div className="w-full mx-auto space-y-6">
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

          {/* Image Upload */}
          <div>
            <Label htmlFor="image">Event Image (Optional)</Label>
            <div className="mt-2">
              <Input
                id="image"
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Validate file size (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                      alert("Image file size must be less than 5MB");
                      e.target.value = "";
                      return;
                    }
                    handleInputChange("image", file);
                  }
                }}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Upload an image for your event (JPEG, PNG, max 5MB)
              </p>
              {formData.image && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={URL.createObjectURL(formData.image)}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleInputChange("image", undefined);
                      const input = document.getElementById(
                        "image",
                      ) as HTMLInputElement;
                      if (input) input.value = "";
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
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
          <div className="flex items-center justify-between">
            <Label>Location</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetLocation}
              className="flex items-center gap-2"
            >
              <MapPin className="h-4 w-4" />
              Use My Location
            </Button>
          </div>

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

          {/* Show current coordinates if available */}
          {userCoordinates && (
            <div className="text-sm text-muted-foreground">
              📍 Your location: {userCoordinates.lat.toFixed(4)},{" "}
              {userCoordinates.lng.toFixed(4)}
            </div>
          )}

          {/* Additional Location Notes */}
          <div>
            <Label htmlFor="locationNotes">Additional Location Details</Label>
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
    </div>
  );
}
