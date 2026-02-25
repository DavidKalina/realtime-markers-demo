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
    if (
      now >= eventTime &&
      now <= new Date(eventTime.getTime() + 2 * 60 * 60 * 1000)
    ) {
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
  } catch {
    // If there's any error parsing the time, just return the original
    return timeString;
  }
};

/**
 * Parse a date string that may be ISO, "date @ time", or "mm/dd/yyyy" format.
 */
function parseFlexibleDate(dateStr: string): Date {
  if (dateStr.includes("@")) {
    const [datePart, timePart] = dateStr.split("@").map((s) => s.trim());
    const cleanDateStr = datePart.replace(/(st|nd|rd|th),?/g, "");
    const dateObj = new Date(cleanDateStr);

    if (isNaN(dateObj.getTime())) {
      throw new Error("Invalid date format");
    }

    const isPM = timePart.toLowerCase().includes("pm");
    let hours = parseInt(timePart);
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    dateObj.setHours(hours, 0, 0, 0);
    return dateObj;
  }

  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr
      .split("/")
      .map((num) => parseInt(num, 10));
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  return new Date(dateStr);
}

/**
 * Compute a countdown label for an event, matching the logic from TimePopup.
 * Handles ISO dates, "date @ time", and "mm/dd/yyyy" formats.
 *
 * @returns { label, isExpired }
 */
export function getTimeLeftLabel(
  eventDate: string,
  endDate?: string,
): { label: string; isExpired: boolean } {
  try {
    const start = parseFlexibleDate(eventDate);
    const end = endDate ? parseFlexibleDate(endDate) : undefined;

    if (isNaN(start.getTime())) {
      return { label: "NaN", isExpired: true };
    }

    // If end-date provided and we need to handle "mm/dd/yyyy" end dates that
    // parsed as midnight — bump to 23:59:59 only for the slash format.
    if (end && endDate && endDate.includes("/") && !endDate.includes("@")) {
      end.setHours(23, 59, 59);
    }

    const now = new Date();

    // Currently happening (between start and end)
    if (end && now > start && now < end) {
      const diff = end.getTime() - now.getTime();
      const hours = (diff / (1000 * 60 * 60)).toFixed(1);
      return {
        label: `${hours} ${hours === "1.0" ? "hour" : "hours"} left`,
        isExpired: false,
      };
    }

    // Past end date
    if (end && now > end) {
      return { label: "expired", isExpired: true };
    }

    const diff = start.getTime() - now.getTime();

    if (diff < 0) {
      return { label: "expired", isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60);
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return {
        label: `in ${days} ${days === 1 ? "day" : "days"}`,
        isExpired: false,
      };
    }
    if (hours >= 1) {
      return {
        label: `in ${hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`,
        isExpired: false,
      };
    }
    return {
      label: `in ${minutes} ${minutes === 1 ? "min" : "mins"}`,
      isExpired: false,
    };
  } catch (error) {
    console.error("Error parsing date:", error, "eventDate:", eventDate);
    return { label: "NaN", isExpired: true };
  }
}
