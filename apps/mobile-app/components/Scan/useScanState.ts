import { useEffect, useCallback } from "react";
import { useScanReducer } from "./useScanReducer";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useUploadImage } from "@/hooks/useUploadImage";
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
  const { publish } = useEventBroker();
  const { uploadAndTrack } = useUploadImage({
    processImage,
    isNetworkSuitable,
  });

  // Create upload function that wraps the shared hook with scan-specific behavior
  const uploadImageAndQueue = useCallback(
    async (uri: string, imageSource: ImageSource) => {
      if (!isMounted.current) return null;

      try {
        const jobId = await uploadAndTrack(uri, imageSource || "unknown");
        if (!isMounted.current) return null;
        return jobId;
      } catch (error) {
        if (isMounted.current) {
          publish(EventTypes.ERROR_OCCURRED, {
            timestamp: Date.now(),
            source: "ScanScreen",
            error: `Failed to upload image: ${error}`,
          });
        }
        throw error;
      }
    },
    [isMounted, publish, uploadAndTrack],
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
