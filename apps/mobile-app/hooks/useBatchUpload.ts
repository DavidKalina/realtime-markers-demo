import { useCallback, useReducer, useRef } from "react";
import { Alert } from "react-native";

const MAX_IMAGES = 5;

export interface ImageItem {
  id: string;
  uri: string;
  status: "pending" | "uploading" | "success" | "failed";
  jobId?: string;
  error?: string;
}

interface BatchUploadState {
  images: ImageItem[];
  isUploading: boolean;
  currentIndex: number;
  completedCount: number;
  failedCount: number;
}

type BatchAction =
  | { type: "ADD_IMAGES"; uris: string[] }
  | { type: "REMOVE_IMAGE"; id: string }
  | { type: "START_UPLOAD" }
  | { type: "IMAGE_UPLOADING"; index: number }
  | { type: "IMAGE_SUCCESS"; index: number; jobId: string }
  | { type: "IMAGE_FAILED"; index: number; error: string }
  | { type: "UPLOAD_COMPLETE" }
  | { type: "RESET" };

const initialState: BatchUploadState = {
  images: [],
  isUploading: false,
  currentIndex: -1,
  completedCount: 0,
  failedCount: 0,
};

function batchReducer(
  state: BatchUploadState,
  action: BatchAction,
): BatchUploadState {
  switch (action.type) {
    case "ADD_IMAGES": {
      const newImages: ImageItem[] = action.uris.map((uri) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        uri,
        status: "pending" as const,
      }));
      return {
        ...state,
        images: [...state.images, ...newImages].slice(0, MAX_IMAGES),
      };
    }
    case "REMOVE_IMAGE":
      return {
        ...state,
        images: state.images.filter((img) => img.id !== action.id),
      };
    case "START_UPLOAD":
      return {
        ...state,
        isUploading: true,
        currentIndex: 0,
        completedCount: 0,
        failedCount: 0,
      };
    case "IMAGE_UPLOADING":
      return {
        ...state,
        currentIndex: action.index,
        images: state.images.map((img, i) =>
          i === action.index ? { ...img, status: "uploading" as const } : img,
        ),
      };
    case "IMAGE_SUCCESS":
      return {
        ...state,
        completedCount: state.completedCount + 1,
        images: state.images.map((img, i) =>
          i === action.index
            ? { ...img, status: "success" as const, jobId: action.jobId }
            : img,
        ),
      };
    case "IMAGE_FAILED":
      return {
        ...state,
        failedCount: state.failedCount + 1,
        images: state.images.map((img, i) =>
          i === action.index
            ? { ...img, status: "failed" as const, error: action.error }
            : img,
        ),
      };
    case "UPLOAD_COMPLETE":
      return {
        ...state,
        isUploading: false,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface UseBatchUploadDeps {
  uploadAndTrack: (uri: string, imageSource: string) => Promise<string>;
}

export function useBatchUpload({ uploadAndTrack }: UseBatchUploadDeps) {
  const [state, dispatch] = useReducer(batchReducer, initialState);
  const isUploadingRef = useRef(false);

  const addImages = useCallback(
    (uris: string[]) => {
      const remaining = MAX_IMAGES - state.images.length;
      if (remaining <= 0) {
        Alert.alert(
          "Limit Reached",
          `You can upload a maximum of ${MAX_IMAGES} photos at once.`,
        );
        return;
      }
      if (uris.length > remaining) {
        Alert.alert(
          "Too Many Photos",
          `Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added. The first ${remaining} will be used.`,
        );
      }
      dispatch({ type: "ADD_IMAGES", uris: uris.slice(0, remaining) });
    },
    [state.images.length],
  );

  const removeImage = useCallback(
    (id: string) => {
      if (state.isUploading) return;
      dispatch({ type: "REMOVE_IMAGE", id });
    },
    [state.isUploading],
  );

  const startUpload = useCallback(async () => {
    if (state.images.length === 0 || isUploadingRef.current) return;

    isUploadingRef.current = true;
    dispatch({ type: "START_UPLOAD" });

    for (let i = 0; i < state.images.length; i++) {
      dispatch({ type: "IMAGE_UPLOADING", index: i });

      try {
        const jobId = await uploadAndTrack(state.images[i].uri, "batch_upload");
        dispatch({ type: "IMAGE_SUCCESS", index: i, jobId });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Upload failed";
        dispatch({ type: "IMAGE_FAILED", index: i, error: errorMsg });
      }
    }

    dispatch({ type: "UPLOAD_COMPLETE" });
    isUploadingRef.current = false;
  }, [state.images, uploadAndTrack]);

  const reset = useCallback(() => {
    isUploadingRef.current = false;
    dispatch({ type: "RESET" });
  }, []);

  const isDone =
    !state.isUploading && (state.completedCount > 0 || state.failedCount > 0);

  return {
    ...state,
    isDone,
    addImages,
    removeImage,
    startUpload,
    reset,
  };
}
