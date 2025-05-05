import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getCalendars } from "expo-localization";

// Helper to safely get user timezone in React Native
export const getUserTimezone = () => {
  try {
    // Get calendar information which contains timezone
    const deviceCalendars = getCalendars();
    if (deviceCalendars && deviceCalendars.length > 0 && deviceCalendars[0].timeZone) {
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

    return formatInTimeZone(dateObj, effectiveTimezone, "EEEE, MMMM d, yyyy 'at' h:mm a (zzz)");
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
      return formatInTimeZone(dateObj, userTimezone, "'Your time:' h:mm a (zzz)");
    }
    return null;
  } catch (error) {
    console.error("Error calculating user local time:", error);
    return null;
  }
};

// Export the function
export { formatDate, getUserLocalTime };
