import * as TaskManager from "expo-task-manager";

import { apiClient } from "@/services/ApiClient";

export const BACKGROUND_LOCATION_TASK = "background-location-task";

interface LocationTaskBody {
  locations: Array<{
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      speed: number | null;
      heading: number | null;
    };
    timestamp: number;
  }>;
}

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<LocationTaskBody>) => {
    if (error) {
      // kCLErrorDomain Code=0 ("location unknown") is transient — iOS retries automatically
      if (error.code === 0) {
        return;
      }
      console.error("[BackgroundLocation] Task error:", error.message);
      return;
    }

    if (!data?.locations?.length) {
      return;
    }

    const location = data.locations[data.locations.length - 1];
    const { longitude: lng, latitude: lat } = location.coords;

    try {
      await apiClient.sendLocation(lat, lng);
    } catch (err) {
      console.error("[BackgroundLocation] Failed to send location:", err);
    }
  },
);
