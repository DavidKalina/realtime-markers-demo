// src/constants/MessageTypes.ts

export const MessageTypes = {
  // Existing connection messages
  CONNECTION_ESTABLISHED: "connection_established",
  CLIENT_IDENTIFICATION: "client_identification",

  // Existing viewport-related messages
  VIEWPORT_UPDATE: "viewport_update",
  INITIAL_MARKERS: "initial_markers",

  // Existing real-time updates
  MARKER_CREATED: "marker_created",
  MARKER_UPDATED: "marker_updated",
  MARKER_DELETED: "marker_deleted",
  MARKER_DELETE: "marker_delete", // Legacy
  MARKER_UPDATES_BATCH: "marker_updates_batch",
  DEBUG_EVENT: "debug_event",

  // Existing session management messages
  CREATE_SESSION: "create_session",
  JOIN_SESSION: "join_session",
  SESSION_CREATED: "session_created",
  SESSION_JOINED: "session_joined",
  SESSION_UPDATE: "session_update",
  ADD_JOB: "add_job",
  JOB_ADDED: "job_added",
  CANCEL_JOB: "cancel_job",
  CLEAR_SESSION: "clear_session",

  // New subscription management messages
  CREATE_SUBSCRIPTION: "create_subscription",
  UPDATE_SUBSCRIPTION: "update_subscription",
  DELETE_SUBSCRIPTION: "delete_subscription",
  LIST_SUBSCRIPTIONS: "list_subscriptions",
  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_UPDATED: "subscription_updated",
  SUBSCRIPTION_DELETED: "subscription_deleted",
  SUBSCRIPTIONS_LIST: "subscriptions_list",

  // New viewport update acknowledgment
  VIEWPORT_UPDATED: "viewport_updated",

  // New map events message (filtered events)
  MAP_EVENTS: "map_events",

  // Error message type
  ERROR: "error",
};
