import { useState } from "react";
import { z } from "zod";
import { apiClient } from "@/services/ApiClient";
import type { LocationSearchResult } from "@/services/ApiClient";

// Define the schema for private event creation
const privateEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  eventDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  invitedUserIds: z.array(z.string()).optional(),
  emoji: z.string().default("🎉"),
  isProcessedByAI: z.boolean().default(true),
});

export const usePrivateEvent = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = async (formData: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    location: LocationSearchResult;
    invitedUserIds: string[];
  }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate the form data
      const validatedData = privateEventSchema.parse({
        ...formData,
        eventDate: formData.startDate,
        location: {
          type: "Point",
          coordinates: formData.location.coordinates,
        },
      });

      console.log("validatedData", validatedData);

      // Create the event using the API client
      const event = await apiClient.createPrivateEvent(validatedData);
      return event;
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Handle validation errors
        const firstError = err.errors[0];
        setError(firstError.message);
      } else {
        // Handle other errors
        setError("Failed to create event. Please try again.");
        console.error("Error creating private event:", err);
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    createEvent,
    isSubmitting,
    error,
  };
};
