import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";

const CALENDAR_EVENT_KEY_PREFIX = "calendar_event_id:";
const APP_CALENDAR_TITLE = "A Third Space";

class CalendarService {
  private static instance: CalendarService | null = null;

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  /**
   * Request calendar permissions from the user.
   */
  async requestPermission(): Promise<boolean> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  }

  /**
   * Get or create the app's calendar.
   */
  private async getOrCreateCalendarId(): Promise<string | null> {
    try {
      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );

      // Look for existing app calendar
      const existing = calendars.find((c) => c.title === APP_CALENDAR_TITLE);
      if (existing) return existing.id;

      // Create a new calendar
      if (Platform.OS === "ios") {
        const defaultCalendar = calendars.find(
          (c) => c.source && c.source.name === "Default",
        );
        const source = defaultCalendar?.source ?? calendars[0]?.source;
        if (!source) return null;

        return await Calendar.createCalendarAsync({
          title: APP_CALENDAR_TITLE,
          color: "#34d399",
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: source.id,
          source: {
            isLocalAccount: true,
            name: source.name,
            type: source.type,
          },
          name: APP_CALENDAR_TITLE,
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
          ownerAccount: "personal",
        });
      }

      // Android
      return await Calendar.createCalendarAsync({
        title: APP_CALENDAR_TITLE,
        color: "#34d399",
        entityType: Calendar.EntityTypes.EVENT,
        source: {
          isLocalAccount: true,
          name: APP_CALENDAR_TITLE,
          type: Calendar.SourceType.LOCAL,
        },
        name: APP_CALENDAR_TITLE,
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
        ownerAccount: "personal",
      });
    } catch (err) {
      console.error("[CalendarService] Failed to get/create calendar:", err);
      return null;
    }
  }

  /**
   * Add an itinerary to the device calendar.
   */
  async addItineraryToCalendar(
    itinerary: ItineraryResponse,
  ): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return null;

      const calendarId = await this.getOrCreateCalendarId();
      if (!calendarId) return null;

      // Determine start/end time from items
      const items = itinerary.items;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      const dateStr = itinerary.plannedDate; // YYYY-MM-DD
      const startTime = firstItem?.startTime ?? "09:00";
      const endTime = lastItem?.endTime ?? "17:00";

      const startDate = new Date(`${dateStr}T${startTime}:00`);
      const endDate = new Date(`${dateStr}T${endTime}:00`);

      const notes = items
        .map(
          (item, idx) =>
            `${idx + 1}. ${item.emoji ?? ""} ${item.title} (${item.startTime}–${item.endTime})${item.venueName ? ` @ ${item.venueName}` : ""}`,
        )
        .join("\n");

      const eventId = await Calendar.createEventAsync(calendarId, {
        title: itinerary.title ?? "Adventure Day",
        startDate,
        endDate,
        notes,
        location: itinerary.city,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      // Persist the mapping
      await AsyncStorage.setItem(
        `${CALENDAR_EVENT_KEY_PREFIX}${itinerary.id}`,
        eventId,
      );

      console.log(
        `[CalendarService] Added calendar event ${eventId} for itinerary ${itinerary.id}`,
      );
      return eventId;
    } catch (err) {
      console.error("[CalendarService] Failed to add to calendar:", err);
      return null;
    }
  }

  /**
   * Remove a previously added calendar event for an itinerary.
   */
  async removeFromCalendar(itineraryId: string): Promise<void> {
    try {
      const eventId = await AsyncStorage.getItem(
        `${CALENDAR_EVENT_KEY_PREFIX}${itineraryId}`,
      );
      if (!eventId) return;

      await Calendar.deleteEventAsync(eventId);
      await AsyncStorage.removeItem(
        `${CALENDAR_EVENT_KEY_PREFIX}${itineraryId}`,
      );

      console.log(
        `[CalendarService] Removed calendar event for itinerary ${itineraryId}`,
      );
    } catch (err) {
      console.error("[CalendarService] Failed to remove from calendar:", err);
    }
  }

  /**
   * Check if an itinerary already has a calendar event.
   */
  async hasCalendarEvent(itineraryId: string): Promise<boolean> {
    const eventId = await AsyncStorage.getItem(
      `${CALENDAR_EVENT_KEY_PREFIX}${itineraryId}`,
    );
    return eventId !== null;
  }
}

export const calendarService = CalendarService.getInstance();
