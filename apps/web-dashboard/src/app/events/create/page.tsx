"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CreateEventForm } from "@/components/dashboard/CreateEventForm";
import { useRouter } from "next/navigation";
import { MapPreview } from "@/components/dashboard/MapPreview";

export default function CreateEventPage() {
  const router = useRouter();

  const handleSuccess = () => {
    // Redirect to events list after successful creation
    router.push("/events");
  };

  const handleCancel = () => {
    // Go back to previous page
    router.back();
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
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <MapPreview events={[]} />
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
