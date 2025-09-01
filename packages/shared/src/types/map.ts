// Mapbox viewport format
export interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Server marker structure adjusted for Mapbox
export interface Marker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: {
    title: string;
    emoji: string;
    color: string;
    location?: string;
    distance?: string;
    time?: string;
    eventDate?: string;
    endDate?: string;
    description?: string;
    categories?: string[];
    isVerified?: boolean;
    created_at?: string;
    updated_at?: string;
    isPrivate?: boolean;
    status?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface MapWebSocketResult {
  markers: Marker[];
  isConnected: boolean;
  error: Error | null;
  currentViewport: MapboxViewport | null;
  updateViewport: (viewport: MapboxViewport) => void;
  clientId: string | null;
}

export interface UseMapWebSocketConfig {
  clientType: "mobile" | "dashboard";
  useLocationStore: {
    getState: () => {
      setMarkers: (markers: Marker[]) => void;
      selectMarker: (markerId: string | null) => void;
      selectedMarkerId: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe: (listener: (state: any) => void) => () => void;
  };
  eventBroker: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit: <T extends { timestamp: number; source: string }>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventType: any,
      data: T,
    ) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on: (eventType: any, handler: (data: any) => void) => () => void;
  };
  EventTypes: {
    MARKERS_UPDATED: string;
    MARKER_ADDED: string;
    MARKER_REMOVED: string;
    MARKER_DESELECTED: string;
    VIEWPORT_CHANGED: string;
    WEBSOCKET_CONNECTED: string;
    WEBSOCKET_DISCONNECTED: string;
    ERROR_OCCURRED: string;
    EVENT_DISCOVERED: string;
    NOTIFICATION: string;
    LEVEL_UPDATE: string;
    XP_AWARDED: string;
    FORCE_VIEWPORT_UPDATE: string;
  };
  useAuth: () => {
    user: { id: string } | null;
    isAuthenticated: boolean;
  };
}
