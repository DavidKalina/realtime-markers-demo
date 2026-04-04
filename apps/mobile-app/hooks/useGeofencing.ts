import * as Location from "expo-location";

import { CHECKIN_RADIUS_M } from "@realtime-markers/shared";
import type { ObjectiveResponse } from "@/services/api/modules/sidequests";
import { GEOFENCE_TASK } from "@/tasks/geofenceTask";

/**
 * Build geofence regions from unchecked objectives that have coordinates.
 * Prefers entry point coords (trailhead/parking) when available.
 */
function buildRegions(
  objectives: ObjectiveResponse[],
): Location.LocationRegion[] {
  return objectives
    .filter((o) => !o.checkedInAt && o.latitude != null && o.longitude != null)
    .map((o) => ({
      identifier: o.id,
      latitude: Number(o.entryLatitude ?? o.latitude),
      longitude: Number(o.entryLongitude ?? o.longitude),
      radius: CHECKIN_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));
}

/**
 * Register geofences for unchecked objectives.
 * Call on sidequest activation and app restart recovery.
 */
export async function startGeofencing(
  objectives: ObjectiveResponse[],
): Promise<boolean> {
  try {
    const regions = buildRegions(objectives);
    if (regions.length === 0) {
      return false;
    }

    // Stop any existing geofencing before re-registering
    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (isRunning) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    console.log(
      `[Geofencing] Registered ${regions.length} region(s):`,
      regions.map((r) => r.identifier),
    );
    return true;
  } catch (error) {
    console.error("[Geofencing] Failed to start:", error);
    return false;
  }
}

/**
 * Re-register geofences after a check-in (removes completed objective).
 * If no unchecked objectives remain, stops geofencing entirely.
 */
export async function updateGeofences(
  objectives: ObjectiveResponse[],
): Promise<void> {
  const regions = buildRegions(objectives);
  if (regions.length === 0) {
    await stopGeofencing();
    return;
  }

  try {
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    console.log(
      `[Geofencing] Updated to ${regions.length} region(s):`,
      regions.map((r) => r.identifier),
    );
  } catch (error) {
    console.error("[Geofencing] Failed to update:", error);
  }
}

/**
 * Stop all geofencing. Call on deactivation, completion, or logout.
 */
export async function stopGeofencing(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (isRunning) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
      console.log("[Geofencing] Stopped");
    }
  } catch (error) {
    console.error("[Geofencing] Failed to stop:", error);
  }
}

/**
 * Re-register geofences from the active itinerary store on app restart.
 * Import lazily to avoid circular dependency with the store.
 */
export async function ensureGeofencesFromStore(): Promise<void> {
  const { useActiveItineraryStore } = await import(
    "@/stores/useActiveItineraryStore"
  );
  const itinerary = useActiveItineraryStore.getState().itinerary;
  if (!itinerary) return;

  await startGeofencing(itinerary.objectives);
}
