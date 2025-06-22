export const MessageTypes = {
  // Connection messages
  CONNECTION_ESTABLISHED: "connection_established",
  CLIENT_IDENTIFICATION: "client_identification",

  // Viewport-related
  VIEWPORT_UPDATE: "viewport-update",

  // Filtered events from filter processor
  ADD_EVENT: "add-event",
  UPDATE_EVENT: "update-event",
  DELETE_EVENT: "delete-event",
  REPLACE_ALL: "replace-all",

  // Civic engagement messages
  ADD_CIVIC_ENGAGEMENT: "add-civic-engagement",
  UPDATE_CIVIC_ENGAGEMENT: "update-civic-engagement",
  DELETE_CIVIC_ENGAGEMENT: "delete-civic-engagement",

  // Discovery events
  EVENT_DISCOVERED: "event_discovered",
  CIVIC_ENGAGEMENT_DISCOVERED: "civic_engagement_discovered",

  // Notifications
  NOTIFICATION: "notification",

  ADD_JOB: "add_job",
  JOB_ADDED: "job_added",
  CANCEL_JOB: "cancel_job",

  // Session management
  CREATE_SESSION: "create_session",
  CLEAR_SESSION: "clear_session",
  JOIN_SESSION: "join_session",
  SESSION_CREATED: "session_created",
  SESSION_JOINED: "session_joined",
  SESSION_UPDATE: "session_update",

  // Leveling system
  LEVEL_UPDATE: "level-update",
  XP_AWARDED: "xp-awarded",

  // Error handling
  ERROR: "error",
} as const;

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    // Exponential backoff with max 10s
    return Math.min(times * 100, 10000);
  },
};

export const SERVER_CONFIG = {
  port: 8081,
  healthCheckInterval: 30000, // 30 seconds
  viewportExpiration: 3600, // 1 hour
  backendUrl: process.env.BACKEND_URL || "http://backend:3000",
  filterProcessorUrl:
    process.env.FILTER_PROCESSOR_URL || "http://filter-processor:8082",
} as const;

export const REDIS_CHANNELS = {
  DISCOVERED_EVENTS: "discovered_events",
  DISCOVERED_CIVIC_ENGAGEMENTS: "discovered_civic_engagements",
  NOTIFICATIONS: "notifications",
  LEVEL_UPDATE: "level-update",
  FILTER_CHANGES: "filter-changes",
  VIEWPORT_UPDATES: "viewport-updates",
  CIVIC_ENGAGEMENT_CHANGES: "civic_engagement_changes",
} as const;
