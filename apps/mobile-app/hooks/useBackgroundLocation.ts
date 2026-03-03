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

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      deferredUpdatesDistance: 500, // 500m minimum movement
      deferredUpdatesInterval: 900000, // 15 min minimum
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
