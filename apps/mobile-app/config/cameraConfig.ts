export interface CameraSettings {
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  animationDuration?: number;
  animationMode?: "flyTo" | "easeTo";
}

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  zoomLevel: 14,
  animationDuration: 800,
  animationMode: "flyTo",
};

export const createCameraSettings = (
  userLocation: [number, number] | null,
): CameraSettings => ({
  ...DEFAULT_CAMERA_SETTINGS,
  centerCoordinate: userLocation || [0, 0],
});
