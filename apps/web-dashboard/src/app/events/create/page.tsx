"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CreateEventForm } from "@/components/dashboard/CreateEventForm";
import { useRouter } from "next/navigation";

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
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create Event</h1>
            <p className="text-muted-foreground">
              Create a new public or private event
            </p>
          </div>

          <CreateEventForm onSuccess={handleSuccess} onCancel={handleCancel} />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
