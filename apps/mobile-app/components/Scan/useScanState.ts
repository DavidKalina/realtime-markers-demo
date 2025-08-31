import { useEffect, useCallback } from "react";
import { useScanReducer } from "./useScanReducer";
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { apiClient } from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { ImageSource } from "./useScanReducer";

interface UseScanStateProps {
  processImage: (uri: string) => Promise<string | null>;
  isNetworkSuitable: () => boolean;
  isMounted: React.MutableRefObject<boolean>;
  onNavigateToJobs: () => void;
}

export const useScanState = ({
  processImage,
  isNetworkSuitable,
  isMounted,
  onNavigateToJobs,
}: UseScanStateProps) => {
  const { userLocation } = useUserLocation();
  const { publish } = useEventBroker();

  // Create upload function
  const uploadImageAndQueue = useCallback(
    async (uri: string, imageSource: ImageSource) => {
      if (!isMounted.current) return null;

      try {
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

        if (result.jobId && isMounted.current) {
          // Publish job queued event
          publish(EventTypes.JOB_QUEUED, {
            timestamp: Date.now(),
            source: "ScanScreen",
            jobId: result.jobId,
            message: "Document scan queued for processing",
          });

          // Return the job ID - navigation will be handled by the calling function
          return result.jobId;
        } else {
          throw new Error("No job ID returned");
        }
      } catch (error) {
        if (isMounted.current) {
          publish(EventTypes.ERROR_OCCURRED, {
            timestamp: Date.now(),
            source: "ScanScreen",
            error: `Failed to upload image: ${error}`,
          });

          throw error;
        }

        throw error;
      }
    },
    [isMounted, publish, processImage, isNetworkSuitable, userLocation],
  );

  // Use the scan reducer
  const scanState = useScanReducer({
    uploadImageAndQueue,
    isNetworkSuitable,
    isMounted,
    onNavigateToJobs,
  });

  // Auto-initialize camera when component mounts
  useEffect(() => {
    if (
      isMounted.current &&
      !scanState.isCameraInitialized &&
      !scanState.cameraError
    ) {
      scanState.initializeCamera();
    }
  }, []); // Only run once on mount, not on every state change

  return {
    // Scan state from reducer
    ...scanState,

    // Computed values
    isLoading: scanState.isCapturing || scanState.isProcessing,
    canInteract: scanState.isReady,
  };
};
