// Updated message types to align with the new architecture
export const MessageTypes = {
  // Connection messages
  CONNECTION_ESTABLISHED: "connection_established",
  CLIENT_IDENTIFICATION: "client_identification",

  // Viewport-related
  VIEWPORT_UPDATE: "viewport-update",

  // New event types from filter processor
  REPLACE_ALL: "replace-all",
  ADD_EVENT: "add-event",
  UPDATE_EVENT: "update-event",
  DELETE_EVENT: "delete-event",

  // For backward compatibility
  SESSION_UPDATE: "session_update",

  // New event type for discovered events
  EVENT_DISCOVERED: "event_discovered",

  // Notifications
  NOTIFICATION: "notification",

  // Leveling system events
  LEVEL_UPDATE: "level-update",
  XP_AWARDED: "xp-awarded",
};
