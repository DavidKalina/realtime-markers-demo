import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { formatInTimeZone } from "date-fns-tz";
import { calendarService } from "@/services/CalendarService";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";

/**
 * Schedule local reminder notifications for an itinerary.
 * - Evening before (7pm local): "Your adventure is tomorrow!"
 * - Morning of (8am local): "Today's the day!"
 */
async function scheduleReminders(
  itinerary: ItineraryResponse,
): Promise<string[]> {
  const ids: string[] = [];
  const plannedDate = new Date(`${itinerary.plannedDate}T12:00:00`);
  const now = new Date();

  // Evening before — 7pm the day before
  const eveningBefore = new Date(plannedDate);
  eveningBefore.setDate(eveningBefore.getDate() - 1);
  eveningBefore.setHours(19, 0, 0, 0);

  if (eveningBefore > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Adventure tomorrow!",
          body: `"${itinerary.title ?? "Your itinerary"}" is set for tomorrow. Get ready!`,
          data: {
            type: "itinerary_reminder",
            itineraryId: itinerary.id,
          },
        },
        trigger: { type: "date" as const, date: eveningBefore },
      });
      ids.push(id);
    } catch (err) {
      console.warn(
        "[CalendarPrompt] Failed to schedule evening reminder:",
        err,
      );
    }
  }

  // Morning of — 8am
  const morningOf = new Date(plannedDate);
  morningOf.setHours(8, 0, 0, 0);

  if (morningOf > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Today's the day!",
          body: `Time for "${itinerary.title ?? "your adventure"}" — have an amazing time!`,
          data: {
            type: "itinerary_reminder",
            itineraryId: itinerary.id,
          },
        },
        trigger: { type: "date" as const, date: morningOf },
      });
      ids.push(id);
    } catch (err) {
      console.warn(
        "[CalendarPrompt] Failed to schedule morning reminder:",
        err,
      );
    }
  }

  return ids;
}

/**
 * Cancel specific scheduled notifications by ID.
 */
async function cancelReminders(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Already cancelled or expired
    }
  }
}

// Store reminder IDs for cleanup
let activeReminderIds: string[] = [];

/**
 * Headless component that listens for itinerary activation and offers
 * calendar + reminder integration.
 */
export default function CalendarPrompt() {
  const itinerary = useActiveItineraryStore((s) => s.itinerary);
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = itinerary?.id ?? null;

    // New itinerary activated
    if (currentId && currentId !== prevIdRef.current && itinerary) {
      prevIdRef.current = currentId;

      // Schedule local reminders silently
      scheduleReminders(itinerary).then((ids) => {
        activeReminderIds = ids;
      });

      // Prompt for calendar
      promptCalendar(itinerary);
    }

    // Itinerary deactivated
    if (!currentId && prevIdRef.current) {
      prevIdRef.current = null;

      // Cancel scheduled reminders
      if (activeReminderIds.length > 0) {
        cancelReminders(activeReminderIds);
        activeReminderIds = [];
      }
    }
  }, [itinerary?.id]);

  return null;
}

async function promptCalendar(itinerary: ItineraryResponse) {
  // Don't prompt if the planned date is today (already happening)
  const today = formatInTimeZone(new Date(), getUserTimezone(), "yyyy-MM-dd");
  if (itinerary.plannedDate === today) return;

  // Don't prompt if already added to calendar
  const alreadyAdded = await calendarService.hasCalendarEvent(itinerary.id);
  if (alreadyAdded) return;

  Alert.alert(
    "Add to Calendar?",
    `Add "${itinerary.title ?? "your adventure"}" on ${itinerary.plannedDate} to your calendar?`,
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Add",
        onPress: async () => {
          await calendarService.addItineraryToCalendar(itinerary);
        },
      },
    ],
  );
}
