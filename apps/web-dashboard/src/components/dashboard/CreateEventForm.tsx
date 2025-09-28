"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiService, type CreateEventPayload } from "@/services/api";
import { Globe, Lock, MapPin, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { EmojiPicker } from "./EmojiPicker";
import { LocationSearch } from "./LocationSearch";

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
  endDate?: string;
  endTime?: string;
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
  // QR code related fields
  qrUrl?: string;
  // Recurring event fields
  isRecurring: boolean;
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceDays?: string[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
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

    // Validate end date if provided
    if (formData.endDate && formData.endTime) {
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      if (endDateTime <= eventDateTime) {
        newErrors.endDate = "End date/time must be after start date/time";
      }
    }

    // Validate recurring event fields
    if (formData.isRecurring) {
      if (!formData.recurrenceFrequency) {
        newErrors.recurrenceFrequency = "Recurrence frequency is required";
      }

      if (formData.recurrenceStartDate) {
        const recurrenceStart = new Date(formData.recurrenceStartDate);
        if (recurrenceStart < new Date(formData.date)) {
          newErrors.recurrenceStartDate =
            "Recurrence start date cannot be before event date";
        }
      }

      if (formData.recurrenceEndDate && formData.recurrenceStartDate) {
        const recurrenceEnd = new Date(formData.recurrenceEndDate);
        const recurrenceStart = new Date(formData.recurrenceStartDate);
        if (recurrenceEnd <= recurrenceStart) {
          newErrors.recurrenceEndDate =
            "Recurrence end date must be after start date";
        }
      }

      if (
        (formData.recurrenceFrequency === "WEEKLY" ||
          formData.recurrenceFrequency === "BIWEEKLY") &&
        (!formData.recurrenceDays || formData.recurrenceDays.length === 0)
      ) {
        newErrors.recurrenceDays = "Please select at least one day of the week";
      }
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

      // Create end date if provided
      let endDate: string | undefined;
      if (formData.endDate && formData.endTime) {
        endDate = new Date(
          `${formData.endDate}T${formData.endTime}`,
        ).toISOString();
      }

      const eventPayload: CreateEventPayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        date: eventDateTime.toISOString(),
        eventDate: eventDateTime.toISOString(),
        endDate: endDate,
        isPrivate: formData.isPrivate,
        emoji: formData.emoji,
        location: {
          type: "Point",
          coordinates: selectedLocation ? selectedLocation.coordinates : [0, 0],
        },
        address: selectedLocation?.address || "",
        locationNotes:
          selectedLocation?.locationNotes || formData.locationNotes,
        userCoordinates: userCoordinates || undefined,
        image: formData.image,
        // QR code related fields
        qrUrl: formData.qrUrl,
        // Recurring event fields
        isRecurring: formData.isRecurring,
        recurrenceFrequency: formData.recurrenceFrequency as any,
        recurrenceDays: formData.recurrenceDays as any,
        recurrenceStartDate: formData.recurrenceStartDate,
        recurrenceEndDate: formData.recurrenceEndDate,
        recurrenceInterval: formData.recurrenceInterval,
        recurrenceTime: formData.recurrenceTime,
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

          {/* QR Code URL */}
          <div>
            <Label htmlFor="qrUrl">QR Code URL (Optional)</Label>
            <Input
              id="qrUrl"
              type="url"
              value={formData.qrUrl || ""}
              onChange={(e) => handleInputChange("qrUrl", e.target.value)}
              placeholder="https://example.com/event-details"
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter a URL to generate a QR code for this event. The QR code will
              be generated on the mobile app.
            </p>
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

        {/* End Date and Time (Optional) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="hasEndDate"
              checked={!!formData.endDate}
              onCheckedChange={(checked) => {
                if (checked) {
                  // Update both fields in a single state update
                  const updatedFormData = {
                    ...formData,
                    endDate: formData.date,
                    endTime: formData.time,
                  };
                  onFormDataChange(updatedFormData);
                } else {
                  // Clear both fields in a single state update
                  const updatedFormData = {
                    ...formData,
                    endDate: "",
                    endTime: "",
                  };
                  onFormDataChange(updatedFormData);
                }
              }}
            />
            <Label htmlFor="hasEndDate" className="text-sm font-medium">
              Event has end date/time
            </Label>
          </div>

          {formData.endDate && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                  min={formData.date}
                  className={errors.endDate ? "border-red-500" : ""}
                />
                {errors.endDate && (
                  <p className="text-sm text-red-500 mt-1">{errors.endDate}</p>
                )}
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime || ""}
                  onChange={(e) => handleInputChange("endTime", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Recurring Event Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isRecurring"
              checked={formData.isRecurring}
              onCheckedChange={(checked) =>
                handleInputChange("isRecurring", checked)
              }
            />
            <Label htmlFor="isRecurring" className="text-base font-medium">
              This is a recurring event
            </Label>
          </div>

          {formData.isRecurring && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              {/* Recurrence Frequency */}
              <div>
                <Label htmlFor="recurrenceFrequency">Frequency *</Label>
                <Select
                  value={formData.recurrenceFrequency}
                  onValueChange={(value) =>
                    handleInputChange("recurrenceFrequency", value)
                  }
                >
                  <SelectTrigger
                    className={
                      errors.recurrenceFrequency ? "border-red-500" : ""
                    }
                  >
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                {errors.recurrenceFrequency && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.recurrenceFrequency}
                  </p>
                )}
              </div>

              {/* Recurrence Interval */}
              <div>
                <Label htmlFor="recurrenceInterval">Interval</Label>
                <Input
                  id="recurrenceInterval"
                  type="number"
                  min="1"
                  max="99"
                  value={formData.recurrenceInterval || 1}
                  onChange={(e) =>
                    handleInputChange(
                      "recurrenceInterval",
                      parseInt(e.target.value) || 1,
                    )
                  }
                  placeholder="1"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Every {formData.recurrenceInterval || 1}{" "}
                  {formData.recurrenceFrequency?.toLowerCase() || "time(s)"}
                </p>
              </div>

              {/* Recurrence Days (for weekly/bi-weekly) */}
              {(formData.recurrenceFrequency === "WEEKLY" ||
                formData.recurrenceFrequency === "BIWEEKLY") && (
                <div>
                  <Label>Days of the week</Label>
                  <div className="grid grid-cols-7 gap-2 mt-2">
                    {[
                      "SUNDAY",
                      "MONDAY",
                      "TUESDAY",
                      "WEDNESDAY",
                      "THURSDAY",
                      "FRIDAY",
                      "SATURDAY",
                    ].map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day}`}
                          checked={
                            formData.recurrenceDays?.includes(day) || false
                          }
                          onCheckedChange={(checked) => {
                            const currentDays = formData.recurrenceDays || [];
                            const newDays = checked
                              ? [...currentDays, day]
                              : currentDays.filter((d) => d !== day);
                            handleInputChange("recurrenceDays", newDays);
                          }}
                        />
                        <Label htmlFor={`day-${day}`} className="text-xs">
                          {day.slice(0, 3)}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {errors.recurrenceDays && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.recurrenceDays}
                    </p>
                  )}
                </div>
              )}

              {/* Recurrence Time */}
              <div>
                <Label htmlFor="recurrenceTime">Time</Label>
                <Input
                  id="recurrenceTime"
                  type="time"
                  value={formData.recurrenceTime || formData.time}
                  onChange={(e) =>
                    handleInputChange("recurrenceTime", e.target.value)
                  }
                />
              </div>

              {/* Recurrence Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recurrenceStartDate">Start Date</Label>
                  <Input
                    id="recurrenceStartDate"
                    type="date"
                    value={formData.recurrenceStartDate || formData.date}
                    onChange={(e) =>
                      handleInputChange("recurrenceStartDate", e.target.value)
                    }
                    min={formData.date}
                    className={
                      errors.recurrenceStartDate ? "border-red-500" : ""
                    }
                  />
                  {errors.recurrenceStartDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.recurrenceStartDate}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="recurrenceEndDate">End Date (Optional)</Label>
                  <Input
                    id="recurrenceEndDate"
                    type="date"
                    value={formData.recurrenceEndDate || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "recurrenceEndDate",
                        e.target.value || undefined,
                      )
                    }
                    min={formData.recurrenceStartDate || formData.date}
                    className={errors.recurrenceEndDate ? "border-red-500" : ""}
                  />
                  {errors.recurrenceEndDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.recurrenceEndDate}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
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
