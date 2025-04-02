import { usePostHog } from 'posthog-react-native';
import { EventType } from '@/types/types';

/**
 * Hook for tracking event-related analytics using PostHog
 * 
 * This hook provides methods to track various user interactions with events:
 * - Event detail views
 * - QR code scans
 * - Event saves
 * - Event shares
 * - Map interactions
 */
export const useEventAnalytics = () => {
    const posthog = usePostHog();

    /**
     * Track when a user views event details
     * @param event The event being viewed
     */
    const trackEventView = (event: EventType) => {
        if (!posthog) return;

        posthog.capture('event_viewed', {
            event_id: event.id,
            event_title: event.title,
            event_date: event.eventDate,
            event_location: event.location,
            event_categories: event.categories,
            event_creator: event.creator?.id,
            event_scan_count: event.scanCount,
            event_save_count: event.saveCount,
            has_qr_code: !!event.qrCodeData || !!event.detectedQrData,
            qr_detected_in_image: event.qrDetectedInImage || false,
        });
    };

    /**
     * Track when a user scans a QR code for an event
     * @param event The event associated with the QR code
     * @param source Whether the QR was scanned from the app or from an image
     */
    const trackQRCodeScan = (event: EventType, source: 'app' | 'image' = 'app') => {
        if (!posthog) return;

        posthog.capture('qr_code_scanned', {
            event_id: event.id,
            event_title: event.title,
            qr_source: source,
            qr_url: event.qrCodeData || event.detectedQrData,
        });
    };

    /**
     * Track when a user clicks on a QR code link
     * @param event The event associated with the QR code
     * @param url The URL that was opened
     */
    const trackQRCodeLinkClick = (event: EventType, url: string) => {
        if (!posthog) return;

        posthog.capture('qr_code_link_clicked', {
            event_id: event.id,
            event_title: event.title,
            qr_url: url,
        });
    };

    /**
     * Track when a user saves an event
     * @param event The event being saved
     * @param action Whether the event was saved or unsaved
     */
    const trackEventSave = (event: EventType, action: 'save' | 'unsave') => {
        if (!posthog) return;

        posthog.capture('event_saved', {
            event_id: event.id,
            event_title: event.title,
            action,
        });
    };

    /**
     * Track when a user shares an event
     * @param event The event being shared
     * @param method The sharing method used
     */
    const trackEventShare = (event: EventType, method: string) => {
        if (!posthog) return;

        posthog.capture('event_shared', {
            event_id: event.id,
            event_title: event.title,
            share_method: method,
        });
    };

    /**
     * Track when a user opens the map for an event
     * @param event The event being viewed on the map
     */
    const trackMapOpen = (event: EventType) => {
        if (!posthog) return;

        posthog.capture('event_map_opened', {
            event_id: event.id,
            event_title: event.title,
            event_location: event.location,
            event_coordinates: event.coordinates,
        });
    };

    /**
     * Track when a user gets directions to an event
     * @param event The event to get directions to
     * @param userLocation The user's current location
     */
    const trackGetDirections = (event: EventType, userLocation: [number, number]) => {
        if (!posthog) return;

        posthog.capture('event_directions_requested', {
            event_id: event.id,
            event_title: event.title,
            event_location: event.location,
            event_coordinates: event.coordinates,
            user_location: userLocation,
        });
    };

    return {
        trackEventView,
        trackQRCodeScan,
        trackQRCodeLinkClick,
        trackEventSave,
        trackEventShare,
        trackMapOpen,
        trackGetDirections,
    };
};

export default useEventAnalytics; 