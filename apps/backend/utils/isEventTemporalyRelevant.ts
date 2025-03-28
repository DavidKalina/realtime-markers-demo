// In worker.ts
import { differenceInDays } from "date-fns"; // Add this import at the top

// Add configuration constants (you can move these to ConfigService if preferred)
const MAX_DAYS_IN_PAST = 0; // No past events allowed
const MAX_DAYS_IN_FUTURE = 180; // Events more than 180 days in the future are filtered out

// Add this function to validate event dates
export function isEventTemporalyRelevant(eventDate: Date): {
  valid: boolean;
  reason?: string;
  daysFromNow?: number;
} {
  const now = new Date();
  const daysFromNow = differenceInDays(eventDate, now);

  // Check if event is too far in the past
  if (daysFromNow < MAX_DAYS_IN_PAST) {
    return {
      valid: false,
      reason: "Event date is in the past",
      daysFromNow,
    };
  }

  // Check if event is too far in the future
  if (daysFromNow > MAX_DAYS_IN_FUTURE) {
    return {
      valid: false,
      reason: "Event date is too far in the future",
      daysFromNow,
    };
  }

  return { valid: true, daysFromNow };
}
