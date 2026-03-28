import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { sendLocationToBackend } from "@/utils/sendLocationToBackend";

export const GEOFENCE_TASK = "geofence-proximity-task";

interface GeofenceTaskBody {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

TaskManager.defineTask(
  GEOFENCE_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<GeofenceTaskBody>) => {
    if (error) {
      console.error("[Geofence] Task error:", error.message);
      return;
    }

    if (!data) {
      return;
    }

    const { eventType, region } = data;

    // Only care about entering a geofence region
    if (eventType !== Location.GeofencingEventType.Enter) {
      return;
    }

    console.log(
      `[Geofence] Entered region ${region.identifier} (${region.latitude}, ${region.longitude})`,
    );

    try {
      // Send the region center (objective location) as the user's position.
      // The user is within the geofence radius (75m) of this point, so the
      // backend's PostGIS ST_DWithin check will succeed.
      await sendLocationToBackend(region.latitude, region.longitude);
    } catch (err) {
      console.error("[Geofence] Failed to send location:", err);
    }
  },
);
