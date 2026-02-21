import { EventType } from "@/types/types";

/**
 * Hook for tracking event-related analytics
 *
 * This hook provides methods to track various user interactions with events:
 * - Event detail views
 * - QR code scans
 * - Event saves
 * - Event shares
 * - Map interactions
 *
 * Currently logs to console in dev mode and is a no-op in production.
 * Replace the safeCapture implementation to wire up a real analytics provider.
 */
export const useEventAnalytics = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeCapture = (eventName: string, properties: Record<string, any>) => {
    if (__DEV__) {
      console.log(`[Analytics] ${eventName}:`, properties);
    }
  };

  /**
   * Track when a user views event details
   * @param event The event being viewed
   */
  const trackEventView = (event: EventType | null | undefined) => {
    if (!event || !event.id) return;

    safeCapture("event_viewed", {
      event_id: event.id,
      event_title: event.title || "Untitled Event",
      event_date: event.eventDate,
      event_location: event.location,
      event_categories: event.categories || [],
      event_creator: event.creator?.id,
      event_scan_count: event.scanCount || 0,
      event_save_count: event.saveCount || 0,
      has_qr_code: !!(event.qrCodeData || event.detectedQrData),
      qr_detected_in_image: !!event.qrDetectedInImage,
    });
  };

  /**
   * Track when a user scans a QR code for an event
   * @param event The event associated with the QR code
   * @param source Whether the QR was scanned from the app or from an image
   */
  const trackQRCodeScan = (
    event: EventType | null | undefined,
    source: "app" | "image" = "app",
  ) => {
    if (!event || !event.id) return;

    safeCapture("qr_code_scanned", {
      event_id: event.id,
      event_title: event.title || "Untitled Event",
      qr_source: source,
      qr_url: event.qrCodeData || event.detectedQrData || "",
    });
  };

  /**
   * Track when a user clicks on a QR code link
   * @param event The event associated with the QR code
   * @param url The URL that was opened
   */
  const trackQRCodeLinkClick = (
    event: EventType | null | undefined,
    url: string,
  ) => {
    if (!event || !event.id || !url) return;

    safeCapture("qr_code_link_clicked", {
      event_id: event.id,
      event_title: event.title || "Untitled Event",
      qr_url: url,
    });
  };

  /**
   * Track when a user saves an event
   * @param event The event being saved
   * @param action Whether the event was saved or unsaved
   */
  const trackEventSave = (
    event: EventType | null | undefined,
    action: "save" | "unsave",
  ) => {
    if (!event || !event.id) return;

    safeCapture("event_saved", {
      event_id: event.id,
      event_title: event.title || "Untitled Event",
      action,
    });
  };

  /**
   * Track when a user shares an event
   * @param event The event being shared
   * @param method The sharing method used
   */

  /**
   * Track when a user opens the map for an event
   * @param event The event being viewed on the map
   */
  const trackMapOpen = (event: EventType | null | undefined) => {
    if (!event || !event.id) return;

    safeCapture("event_map_opened", {
      event_id: event.id,
      event_title: event.title || "Untitled Event",
      event_location: event.location || "",
      event_coordinates: event.location || [],
    });
  };

  /**
   * Track when a user gets directions to an event
   * @param event The event to get directions to
   * @param userLocation The user's current location
   */
  const trackGetDirections = (
    event: EventType | null | undefined,
    userLocation: [number, number] | null | undefined,
  ) => {
    if (!event || !event.id || !userLocation || userLocation.length !== 2)
      return;

    safeCapture("event_directions_requested", {
      event_id: event.id,
      event_title: event.title || "Untitled Event",
      event_location: event.location || "",
      event_coordinates: event.location || [],
      user_location: userLocation,
    });
  };

  return {
    trackEventView,
    trackQRCodeScan,
    trackQRCodeLinkClick,
    trackEventSave,
    trackMapOpen,
    trackGetDirections,
  };
};

export default useEventAnalytics;
