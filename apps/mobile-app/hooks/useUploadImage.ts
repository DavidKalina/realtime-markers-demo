import { useCallback } from "react";
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { apiClient } from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";

interface UseUploadImageDeps {
  processImage: (uri: string) => Promise<string | null>;
  isNetworkSuitable: () => boolean;
}

export function useUploadImage({
  processImage,
  isNetworkSuitable,
}: UseUploadImageDeps) {
  const { userLocation } = useUserLocation();
  const { publish } = useEventBroker();
  const { trackJob } = useJobProgressContext();

  const uploadAndTrack = useCallback(
    async (uri: string, imageSource: string): Promise<string> => {
      // Check network before starting upload
      if (!isNetworkSuitable()) {
        throw new Error("Network connection is too weak for upload");
      }

      // Process/compress the image before uploading
      const processedUri = await processImage(uri);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {};

      payload.imageFile = {
        uri: processedUri || uri,
        name: "image.jpg",
        type: "image/jpeg",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      // Add location data if available
      if (userLocation) {
        payload.userLat = userLocation[1].toString();
        payload.userLng = userLocation[0].toString();
      }

      // Add source information to track analytics
      payload.source = imageSource || "unknown";

      // Upload using API client
      const result = await apiClient.events.processEventImage({
        imageFile: payload.imageFile,
        userLat: payload.userLat,
        userLng: payload.userLng,
        source: payload.source,
      });

      if (!result.jobId) {
        throw new Error("No job ID returned");
      }

      // Track job progress via SSE
      trackJob(result.jobId);

      // Publish job queued event
      publish(EventTypes.JOB_QUEUED, {
        timestamp: Date.now(),
        source: "UploadImage",
        jobId: result.jobId,
        message: "Document scan queued for processing",
      });

      return result.jobId;
    },
    [isNetworkSuitable, processImage, userLocation, publish, trackJob],
  );

  return { uploadAndTrack };
}
