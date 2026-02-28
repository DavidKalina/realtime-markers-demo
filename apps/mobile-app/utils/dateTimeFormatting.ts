import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getCalendars } from "expo-localization";

// Helper to safely get user timezone in React Native
export const getUserTimezone = () => {
  try {
    // Get calendar information which contains timezone
    const deviceCalendars = getCalendars();
    if (
      deviceCalendars &&
      deviceCalendars.length > 0 &&
      deviceCalendars[0].timeZone
    ) {
      return deviceCalendars[0].timeZone;
    }
    return "UTC"; // Fallback to UTC
  } catch (error) {
    console.warn("Could not determine user timezone:", error);
    return "UTC";
  }
};

const formatDate = (dateString: string, timezone?: string) => {
  if (!dateString) return "Date not available";

  try {
    const dateObj = parseISO(dateString);

    // Use the event timezone if provided, otherwise fall back to user timezone
    const effectiveTimezone = timezone || getUserTimezone();

    return formatInTimeZone(dateObj, effectiveTimezone, "MMM d, yyyy");
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString; // Fallback to the original string
  }
};

// Function to get the user's local time if timezone differs
const getUserLocalTime = (dateString: string, eventTimezone?: string) => {
  if (!dateString || !eventTimezone) return null;

  try {
    const dateObj = parseISO(dateString);
    const userTimezone = getUserTimezone();

    // Only show user's local time if it differs from event timezone
    if (userTimezone && userTimezone !== eventTimezone) {
      return formatInTimeZone(
        dateObj,
        userTimezone,
        "'Your time:' h:mm a (zzz)",
      );
    }
    return null;
  } catch (error) {
    console.error("Error calculating user local time:", error);
    return null;
  }
};

// Recurrence formatting helpers
export const formatRecurrenceFrequency = (frequency?: string): string => {
  if (!frequency) return "";
  switch (frequency) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "BIWEEKLY":
      return "Every 2 weeks";
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    default:
      return frequency.toLowerCase();
  }
};

export const formatRecurrenceDays = (days?: string[]): string => {
  if (!days || days.length === 0) return "";
  return days.join(", ");
};

const formatDateTime = (dateString: string, timezone?: string) => {
  if (!dateString) return "Date not available";

  try {
    const dateObj = parseISO(dateString);
    const effectiveTimezone = timezone || getUserTimezone();

    return formatInTimeZone(dateObj, effectiveTimezone, "MMM d, yyyy · h:mm a");
  } catch (error) {
    console.error("Error formatting date/time:", error);
    return dateString;
  }
};

// Export the function
export { formatDate, formatDateTime, getUserLocalTime };
