"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CreateEventForm } from "@/components/dashboard/CreateEventForm";
import { useRouter } from "next/navigation";
import { MapPreview } from "@/components/dashboard/MapPreview";

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
  // Recurring event fields
  isRecurring: boolean;
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceDays?: string[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
}

interface SelectedLocation {
  name: string;
  address: string;
  coordinates: [number, number];
  placeId: string;
  locationNotes?: string;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toISOString().split("T")[1].substring(0, 5),
    endDate: "",
    endTime: "",
    isPrivate: false,
    emoji: undefined,
    location: {
      latitude: 0,
      longitude: 0,
      address: "",
    },
    sharedWithIds: [],
    locationNotes: "",
    isRecurring: false,
  });
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);

  const handleSuccess = () => {
    // Redirect to events list after successful creation
    router.push("/events");
  };

  const handleCancel = () => {
    // Go back to previous page
    router.back();
  };

  const handleFormDataChange = (newFormData: EventFormData) => {
    setFormData(newFormData);
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 h-full">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create Event</h1>
            <p className="text-muted-foreground">
              Create a new public or private event
            </p>
          </div>
          <div
            className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0"
            style={{ height: "calc(100vh - 160px)" }}
          >
            <div className="flex-1 min-w-0 flex flex-col">
              <CreateEventForm
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                formData={formData}
                onFormDataChange={handleFormDataChange}
                selectedLocation={selectedLocation}
                onLocationSelect={handleLocationSelect}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <MapPreview
                formData={formData}
                selectedLocation={selectedLocation}
                onLocationSelect={handleLocationSelect}
              />
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
