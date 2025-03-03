// utils/timeUtils.ts

/**
 * Format time until event starts or indicates if it's happening now
 * @param timeString ISO date string for the event time
 * @returns Formatted time string
 */
export const formatTimeInfo = (timeString: string | undefined): string => {
  if (!timeString) return "";

  try {
    // Parse the event time
    const eventTime = new Date(timeString);
    const now = new Date();

    // If date is invalid, return the original string
    if (isNaN(eventTime.getTime())) {
      return timeString;
    }

    // Check if event is happening now (within 2 hours of start time)
    if (now >= eventTime && now <= new Date(eventTime.getTime() + 2 * 60 * 60 * 1000)) {
      return "Happening now";
    }

    // Calculate time difference
    const diffMs = eventTime.getTime() - now.getTime();

    // Return appropriate format based on timeframe
    if (diffMs < 0) {
      return "Event has ended";
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return `Starts in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) {
      return `Starts in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
      return `Starts in ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    }

    return "Starting soon";
  } catch (e) {
    // If there's any error parsing the time, just return the original
    return timeString;
  }
};
