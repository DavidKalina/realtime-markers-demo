# Scan Components - useReducer State Management

This directory contains the scan components that use `useReducer` for comprehensive state management with a clear logical flow. **All functionality goes through the reducer - no backward compatibility with old hooks.**

## Logical Flow

The scan process follows this logical flow:

1. **Initialize Camera** → Camera is initialized and ready for capture
2. **Capture** → Image is captured from camera or selected from gallery
3. **Processing** → Image is processed and uploaded to the server
4. **Redirect to /jobs** → User is automatically redirected to the jobs screen

## Core Hook

### `useScanReducer`

A comprehensive `useReducer`-based hook that manages ALL scan-related state including camera, capture, processing, upload, navigation, and scan limits.

**State Structure:**

```typescript
interface ScanState {
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

  // Upload state
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;

  // Navigation state
  shouldNavigateToJobs: boolean;

  // Scan limits state
  planDetails: PlanDetails | null;
  isCheckingPlan: boolean;
  showNoScansOverlay: boolean;

  // Error state
  error: string | null;
}
```

**Actions:**

- `INITIALIZE_CAMERA` - Start camera initialization
- `CAMERA_INITIALIZED` - Camera is ready
- `CAMERA_ERROR` - Camera initialization failed
- `START_CAPTURE` - Begin image capture
- `CAPTURE_SUCCESS` - Image captured successfully
- `CAPTURE_ERROR` - Image capture failed
- `START_PROCESSING` - Begin image processing
- `SET_PROCESSING_STAGE` - Update processing stage
- `START_UPLOAD` - Begin image upload
- `UPLOAD_PROGRESS` - Update upload progress
- `UPLOAD_SUCCESS` - Upload completed
- `UPLOAD_ERROR` - Upload failed
- `PROCESSING_SUCCESS` - Processing completed
- `NAVIGATE_TO_JOBS` - Trigger navigation to jobs
- `FETCH_PLAN_START` - Start fetching plan details
- `FETCH_PLAN_SUCCESS` - Plan details fetched successfully
- `FETCH_PLAN_ERROR` - Plan details fetch failed
- `SET_SHOW_NO_SCANS_OVERLAY` - Show/hide no scans overlay
- `RESET` - Reset all state
- `CLEAR_ERROR` - Clear error state

### `useScanState`

A unified hook that combines the reducer with image upload functionality:

- Uses `useScanReducer` for all state management
- Handles image upload and processing
- Provides computed values for UI state
- **No external dependencies on old hooks**

**Usage:**

```typescript
const {
  // State
  isCameraInitialized,
  isCapturing,
  isProcessing,
  processingStage,
  showProcessingOverlay,
  capturedImageUri,
  hasRemainingScans,
  showNoScansOverlay,

  // Actions
  handleCapture,
  handleImageSelected,
  setShowNoScansOverlay,
  reset,
  clearError,

  // Computed values
  isLoading,
  canInteract,
} = useScanState({
  processImage,
  isNetworkSuitable,
  isMounted,
  onNavigateToJobs,
});
```

## Example Component

### `ScanExample`

A complete example component demonstrating how to use the new `useScanState` hook:

```typescript
import { useScanState } from "@/Scan";

const ScanExample = () => {
  const {
    isCameraInitialized,
    isCapturing,
    isProcessing,
    processingStage,
    showProcessingOverlay,
    capturedImageUri,
    hasRemainingScans,
    showNoScansOverlay,
    handleCapture,
    handleImageSelected,
    setShowNoScansOverlay,
    reset,
    canInteract,
  } = useScanState({
    processImage,
    isNetworkSuitable,
    isMounted,
    onNavigateToJobs,
  });

  const onCapturePress = async () => {
    const result = await handleCapture(takePicture);
    if (!result.success) {
      // Handle error
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={onCapturePress} disabled={!canInteract}>
        <Text>Capture Photo</Text>
      </TouchableOpacity>

      <ProcessingOverlay
        isVisible={showProcessingOverlay}
        stage={processingStage}
        capturedImageUri={capturedImageUri}
      />

      <NoScansOverlay
        isVisible={showNoScansOverlay}
        onDismiss={() => setShowNoScansOverlay(false)}
        onUpgrade={() => {/* handle upgrade */}}
      />
    </View>
  );
};
```

## Benefits of useReducer Approach

1. **Single Source of Truth** - All state managed in one place
2. **Predictable State Transitions** - All state changes go through the reducer
3. **Clear Action Types** - Each action has a specific purpose and payload
4. **Easier Testing** - Actions can be tested independently
5. **Better Debugging** - State changes are traceable
6. **Logical Flow** - The flow from camera initialization to job navigation is clear
7. **No External Dependencies** - Everything is self-contained
8. **Type Safety** - Full TypeScript support with proper interfaces

## State Flow Diagram

```
Initialize Camera → Capture → Processing → Redirect to /jobs
       ↓              ↓          ↓              ↓
  CAMERA_INITIALIZED → START_CAPTURE → START_PROCESSING → NAVIGATE_TO_JOBS
       ↓              ↓          ↓              ↓
  isCameraInitialized → isCapturing → isProcessing → shouldNavigateToJobs
```

## Scan Limits Integration

Scan limits are now fully integrated into the reducer:

- **Automatic Fetching** - Plan details are fetched on mount
- **State Management** - All scan limit state is managed by the reducer
- **UI Integration** - No scans overlay is controlled by the reducer
- **Validation** - Scan limits are checked before capture/processing

## Available Exports

```typescript
// Hooks
export { useScanReducer } from "./useScanReducer";
export { useScanState } from "./useScanState";

// Components
export { ProcessingOverlay } from "./ProcessingOverlay";
export { NoScansOverlay } from "./NoScansOverlay";
export { SimulationButton } from "./SimulationButton";
export { ScanExample } from "./ScanExample";

// Types
export type { ProcessingStage } from "./ProcessingOverlay";
export type { ImageSource, ScanState, ScanAction } from "./useScanReducer";
```

This approach provides a completely self-contained, predictable, and maintainable state management solution for the scan functionality with no external dependencies on legacy hooks.
