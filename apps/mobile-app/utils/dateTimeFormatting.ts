import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const formatDate = (dateString: string, timezone?: string) => {
  if (!dateString) return "Date not available";

  try {
    const dateObj = parseISO(dateString);

    // First line shows date and time in event's local timezone
    const localTimeStr = timezone
      ? formatInTimeZone(dateObj, timezone, "EEEE, MMMM d, yyyy 'at' h:mm a (zzz)")
      : format(dateObj, "EEEE, MMMM d, yyyy 'at' h:mm a");

    return localTimeStr;
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
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Only show user's local time if it differs from event timezone
    if (userTimezone !== eventTimezone) {
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
