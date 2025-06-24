import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { Alert } from "react-native";
import { ProcessingStage } from "./ProcessingOverlay";

export type ImageSource = "camera" | "gallery" | null;

// Define the scan state
export interface ScanState {
  // Camera state
  isCameraInitialized: boolean;
  cameraError: string | null;

  // Capture state
  isCapturing: boolean;
  capturedImageUri: string | null;
  imageSource: ImageSource;

  // Processing state
  isProcessing: boolean;
  processingStage: ProcessingStage;
  showProcessingOverlay: boolean;

  // Content type choice state
  showContentTypeOverlay: boolean;

  // Upload state
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;

  // Navigation state
  shouldNavigateToJobs: boolean;

  // Scan limits state
  showNoScansOverlay: boolean;

  // Error state
  error: string | null;
}

// Define action types
export type ScanAction =
  | { type: "INITIALIZE_CAMERA" }
  | { type: "CAMERA_INITIALIZED" }
  | { type: "CAMERA_ERROR"; payload: string }
  | { type: "START_CAPTURE" }
  | { type: "CAPTURE_SUCCESS"; payload: { uri: string; source: ImageSource } }
  | { type: "CAPTURE_ERROR"; payload: string }
  | { type: "START_PROCESSING" }
  | { type: "SET_PROCESSING_STAGE"; payload: ProcessingStage }
  | { type: "SHOW_CONTENT_TYPE_OVERLAY" }
  | { type: "HIDE_CONTENT_TYPE_OVERLAY" }
  | { type: "START_UPLOAD" }
  | { type: "UPLOAD_PROGRESS"; payload: number }
  | { type: "UPLOAD_SUCCESS" }
  | { type: "UPLOAD_ERROR"; payload: string }
  | { type: "PROCESSING_SUCCESS" }
  | { type: "NAVIGATE_TO_JOBS" }
  | { type: "SET_SHOW_NO_SCANS_OVERLAY"; payload: boolean }
  | { type: "RESET" }
  | { type: "CLEAR_ERROR" };

// Initial state
const initialState: ScanState = {
  isCameraInitialized: false,
  cameraError: null,
  isCapturing: false,
  capturedImageUri: null,
  imageSource: null,
  isProcessing: false,
  processingStage: null,
  showProcessingOverlay: false,
  showContentTypeOverlay: false,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
  shouldNavigateToJobs: false,
  showNoScansOverlay: false,
  error: null,
};

// Reducer function
function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case "INITIALIZE_CAMERA":
      return {
        ...state,
        isCameraInitialized: false,
        cameraError: null,
        error: null,
      };

    case "CAMERA_INITIALIZED":
      return {
        ...state,
        isCameraInitialized: true,
        cameraError: null,
      };

    case "CAMERA_ERROR":
      return {
        ...state,
        isCameraInitialized: false,
        cameraError: action.payload,
        error: action.payload,
      };

    case "START_CAPTURE":
      return {
        ...state,
        isCapturing: true,
        error: null,
      };

    case "CAPTURE_SUCCESS":
      return {
        ...state,
        isCapturing: false,
        capturedImageUri: action.payload.uri,
        imageSource: action.payload.source,
        showContentTypeOverlay: true,
        processingStage: "captured",
        error: null,
      };

    case "CAPTURE_ERROR":
      return {
        ...state,
        isCapturing: false,
        error: action.payload,
      };

    case "START_PROCESSING":
      return {
        ...state,
        isProcessing: true,
        processingStage: "uploading",
        showProcessingOverlay: true,
        error: null,
      };

    case "SET_PROCESSING_STAGE":
      return {
        ...state,
        processingStage: action.payload,
      };

    case "SHOW_CONTENT_TYPE_OVERLAY":
      return {
        ...state,
        showContentTypeOverlay: true,
      };

    case "HIDE_CONTENT_TYPE_OVERLAY":
      return {
        ...state,
        showContentTypeOverlay: false,
      };

    case "START_UPLOAD":
      return {
        ...state,
        isUploading: true,
        uploadProgress: 0,
        uploadError: null,
        error: null,
      };

    case "UPLOAD_PROGRESS":
      return {
        ...state,
        uploadProgress: action.payload,
      };

    case "UPLOAD_SUCCESS":
      return {
        ...state,
        isUploading: false,
        uploadProgress: 100,
        uploadError: null,
      };

    case "UPLOAD_ERROR":
      return {
        ...state,
        isUploading: false,
        uploadError: action.payload,
        error: action.payload,
      };

    case "PROCESSING_SUCCESS":
      return {
        ...state,
        isProcessing: false,
        processingStage: "success",
      };

    case "NAVIGATE_TO_JOBS":
      return {
        ...state,
        shouldNavigateToJobs: true,
      };

    case "SET_SHOW_NO_SCANS_OVERLAY":
      return {
        ...state,
        showNoScansOverlay: action.payload,
      };

    case "RESET":
      return initialState;

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
        cameraError: null,
        uploadError: null,
      };

    default:
      return state;
  }
}

// Hook interface
interface UseScanReducerProps {
  uploadImageAndQueue: (
    uri: string,
    imageSource: ImageSource,
  ) => Promise<string | null>;
  isNetworkSuitable: () => boolean;
  isMounted: React.MutableRefObject<boolean>;
  onNavigateToJobs: () => void;
}

export const useScanReducer = ({
  uploadImageAndQueue,
  isNetworkSuitable,
  isMounted,
  onNavigateToJobs,
}: UseScanReducerProps) => {
  const [state, dispatch] = useReducer(scanReducer, initialState);
  const { publish } = useEventBroker();

  // Store functions in refs to avoid dependency issues
  const uploadImageAndQueueRef = useRef(uploadImageAndQueue);
  const isNetworkSuitableRef = useRef(isNetworkSuitable);
  const onNavigateToJobsRef = useRef(onNavigateToJobs);

  // Update refs when dependencies change
  useEffect(() => {
    uploadImageAndQueueRef.current = uploadImageAndQueue;
  }, [uploadImageAndQueue]);

  useEffect(() => {
    isNetworkSuitableRef.current = isNetworkSuitable;
  }, [isNetworkSuitable]);

  useEffect(() => {
    onNavigateToJobsRef.current = onNavigateToJobs;
  }, [onNavigateToJobs]);

  // Handle navigation when shouldNavigateToJobs becomes true
  useEffect(() => {
    if (state.shouldNavigateToJobs && isMounted.current) {
      onNavigateToJobsRef.current();
      dispatch({ type: "RESET" });
    }
  }, [state.shouldNavigateToJobs, isMounted]);

  // Initialize camera
  const initializeCamera = useCallback(() => {
    if (!isMounted.current) return;

    dispatch({ type: "INITIALIZE_CAMERA" });

    // Simulate camera initialization (replace with actual camera initialization logic)
    setTimeout(() => {
      if (isMounted.current) {
        dispatch({ type: "CAMERA_INITIALIZED" });
      }
    }, 1000);
  }, [isMounted]);

  // Handle image capture
  const handleCapture = useCallback(
    async (takePicture: () => Promise<string>) => {
      if (!isMounted.current) return { success: false, error: "unmounted" };

      // Check remaining scans

      // Check network
      if (!isNetworkSuitableRef.current()) {
        Alert.alert(
          "Poor Network Connection",
          "Please ensure you have a stable network connection before capturing.",
          [{ text: "OK" }],
        );
        return { success: false, error: "network" };
      }

      try {
        dispatch({ type: "START_CAPTURE" });

        // Take picture
        const photoUri = await takePicture();

        if (!photoUri || !isMounted.current) {
          throw new Error("Failed to capture image");
        }

        // Capture success - show content type overlay
        dispatch({
          type: "CAPTURE_SUCCESS",
          payload: { uri: photoUri, source: "camera" },
        });

        publish(EventTypes.NOTIFICATION, {
          timestamp: Date.now(),
          source: "ScanScreen",
          message: "Image captured successfully!",
        });

        return { success: true };
      } catch (error) {
        console.error("Capture failed:", error);

        if (isMounted.current) {
          dispatch({ type: "CAPTURE_ERROR", payload: "capture_failed" });

          Alert.alert(
            "Operation Failed",
            "Failed to capture the image. Please try again.",
            [{ text: "OK" }],
          );
        }

        return { success: false, error: "capture_failed" };
      }
    },
    [isMounted, publish],
  );

  // Handle image selection from gallery
  const handleImageSelected = useCallback(
    async (uri: string) => {
      if (!isMounted.current) return { success: false, error: "unmounted" };

      // Check remaining scans

      // Check network
      if (!isNetworkSuitableRef.current()) {
        Alert.alert(
          "Poor Network Connection",
          "Please ensure you have a stable network connection before selecting an image.",
          [{ text: "OK" }],
        );
        return { success: false, error: "network" };
      }

      try {
        // Capture success (for gallery image)
        dispatch({
          type: "CAPTURE_SUCCESS",
          payload: { uri, source: "gallery" },
        });

        publish(EventTypes.NOTIFICATION, {
          timestamp: Date.now(),
          source: "ScanScreen",
          message: "Image selected successfully!",
        });

        return { success: true };
      } catch (error) {
        console.error("Gallery image processing failed:", error);

        if (isMounted.current) {
          dispatch({ type: "CAPTURE_ERROR", payload: "gallery_failed" });

          Alert.alert(
            "Operation Failed",
            "Failed to process the selected image. Please try again.",
            [{ text: "OK" }],
          );
        }

        return { success: false, error: "gallery_failed" };
      }
    },
    [isMounted, publish],
  );

  // Set show no scans overlay
  const setShowNoScansOverlay = useCallback((show: boolean) => {
    dispatch({ type: "SET_SHOW_NO_SCANS_OVERLAY", payload: show });
  }, []);

  // Reset state
  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Clear errors
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  // Simulate capture for development
  const simulateCapture = useCallback(async () => {
    if (!isMounted.current) return;

    // For simulation, we'll create a simple data URI that can be displayed
    // This avoids the image processing issues with external URLs
    const sampleImageUri =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNEE5MEUyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0OCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TYW1wbGUgRG9jdW1lbnQ8L3RleHQ+PC9zdmc+";

    try {
      // Simulate capture success
      dispatch({
        type: "CAPTURE_SUCCESS",
        payload: { uri: sampleImageUri, source: "camera" },
      });

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Simulating document capture...",
      });
    } catch (error) {
      console.error("Simulation failed:", error);
      if (isMounted.current) {
        dispatch({ type: "CAPTURE_ERROR", payload: "simulation_failed" });
      }
    }
  }, [isMounted, publish]);

  // Handle content type selection
  const handleSelectEvent = useCallback(async () => {
    if (!isMounted.current || !state.capturedImageUri) return;

    try {
      // Hide content type overlay and show processing overlay
      dispatch({ type: "HIDE_CONTENT_TYPE_OVERLAY" });
      dispatch({ type: "START_PROCESSING" });

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document for event creation...",
      });

      // Upload the image for event processing
      await uploadImageAndQueueRef.current(
        state.capturedImageUri,
        state.imageSource,
      );

      if (!isMounted.current) return;

      // Processing success
      dispatch({ type: "PROCESSING_SUCCESS" });

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Document processed successfully!",
      });

      // Wait 1.5 seconds to show success state
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!isMounted.current) return;

      // Navigate to jobs
      dispatch({ type: "NAVIGATE_TO_JOBS" });
    } catch (error) {
      console.error("Event processing failed:", error);
      if (isMounted.current) {
        dispatch({ type: "CAPTURE_ERROR", payload: "event_processing_failed" });
        Alert.alert(
          "Operation Failed",
          "Failed to process the document for event creation. Please try again.",
          [{ text: "OK" }],
        );
      }
    }
  }, [isMounted, publish, state.capturedImageUri, state.imageSource]);

  const handleSelectCivicEngagement = useCallback(() => {
    if (!isMounted.current || !state.capturedImageUri) return;

    // Hide content type overlay
    dispatch({ type: "HIDE_CONTENT_TYPE_OVERLAY" });

    // Navigate to civic engagement creation with the image
    // This will be handled by the parent component
    publish(EventTypes.NAVIGATE_TO_CIVIC_ENGAGEMENT, {
      timestamp: Date.now(),
      source: "ScanScreen",
      imageUri: state.capturedImageUri,
      imageSource: state.imageSource,
    });
  }, [isMounted, publish, state.capturedImageUri, state.imageSource]);

  const handleCancelContentType = useCallback(() => {
    dispatch({ type: "HIDE_CONTENT_TYPE_OVERLAY" });
    dispatch({ type: "RESET" });
  }, []);

  // Computed values

  return {
    // State
    ...state,

    // Actions
    initializeCamera,
    handleCapture,
    handleImageSelected,
    setShowNoScansOverlay,
    reset,
    clearError,
    simulateCapture,
    handleSelectEvent,
    handleSelectCivicEngagement,
    handleCancelContentType,

    // Computed values
    isReady: state.isCameraInitialized && !state.error,
    canCapture:
      state.isCameraInitialized && !state.isCapturing && !state.isProcessing,
  };
};
