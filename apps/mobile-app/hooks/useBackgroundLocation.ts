import * as Location from "expo-location";
import { BACKGROUND_LOCATION_TASK } from "@/tasks/backgroundLocationTask";

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    // Check if already running
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRunning) {
      return true;
    }

    // iOS requires foreground permission before requesting background
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      return false;
    }

    // Request background permission (triggers "Allow Always" on iOS)
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      return false;
    }

    // Relaxed cadence — geofencing is the primary proximity trigger,
    // background polling serves as a fallback for edge cases
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Low,
      deferredUpdatesDistance: 1000, // 1km minimum movement
      deferredUpdatesInterval: 1800000, // 30 min minimum
      pausesUpdatesAutomatically: true, // iOS battery optimization
      activityType: Location.ActivityType.OtherNavigation,
      foregroundService: {
        notificationTitle: "Realtime Markers",
        notificationBody: "Tracking location for nearby discoveries",
      },
    });

    return true;
  } catch (error) {
    console.error("[BackgroundLocation] Failed to start:", error);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log("[BackgroundLocation] Stopped");
    }
  } catch (error) {
    console.error("[BackgroundLocation] Failed to stop:", error);
  }
}
