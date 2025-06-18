import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface UseEventDeletionResult {
  deleteEvent: (id: string) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export function useEventDeletion(): UseEventDeletionResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const deleteEvent = useCallback(
    async (id: string) => {
      if (!id) {
        setError("Event ID is required");
        return;
      }

      try {
        setIsDeleting(true);
        setError(null);

        const result = await api.deleteEvent(id);

        if (result.success) {
          // Redirect to events list after successful deletion
          router.push("/events");
        } else {
          setError("Failed to delete event");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete event";
        setError(errorMessage);
      } finally {
        setIsDeleting(false);
      }
    },
    [router],
  );

  return {
    deleteEvent,
    isDeleting,
    error,
  };
}
