// store/useJobSessionStore.ts
import { create } from "zustand";

// Types
export interface Job {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  progressStep: string;
  message?: {
    emoji: string;
    text: string;
  };
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobSessionState {
  sessionId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  jobs: Job[];
  clientId: string;
}

export interface JobSessionActions {
  connect: (existingSessionId?: string) => void;
  addJob: (jobId: string) => boolean;
  cancelJob: (jobId: string) => boolean;
  clearAllJobs: () => boolean;
  setClientId: (clientId: string) => void;
}

export type JobSessionStore = JobSessionState & JobSessionActions;

// A module-level WebSocket variable (kept outside of the Zustand state)
let ws: WebSocket | null = null;

// Message types for WebSocket communication
const MessageTypes = {
  // Client -> Server
  CREATE_SESSION: "create_session",
  JOIN_SESSION: "join_session",
  ADD_JOB: "add_job",
  CANCEL_JOB: "cancel_job",
  CLEAR_SESSION: "clear_session",

  // Server -> Client
  SESSION_CREATED: "session_created",
  SESSION_JOINED: "session_joined",
  SESSION_UPDATE: "session_update",
  ERROR: "error",
};

export const useJobSessionStore = create<JobSessionStore>((set, get) => ({
  // Initial state
  sessionId: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  jobs: [],
  clientId: "",

  // Connect to the WebSocket server
  connect: (existingSessionId?: string) => {
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    set({ isConnecting: true, error: null });

    try {
      ws = new WebSocket(
        process.env.EXPO_PUBLIC_WEB_SOCKET_URL || "ws://localhost:8081",
      );

      ws.onopen = () => {
        set({ isConnected: true, isConnecting: false });
        // Join an existing session or create a new one
        if (existingSessionId) {
          ws?.send(
            JSON.stringify({
              type: MessageTypes.JOIN_SESSION,
              sessionId: existingSessionId,
            }),
          );
        } else {
          ws?.send(
            JSON.stringify({
              type: MessageTypes.CREATE_SESSION,
            }),
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case MessageTypes.SESSION_CREATED:
            case MessageTypes.SESSION_JOINED:
              set({ sessionId: data.data.sessionId });
              break;
            case MessageTypes.SESSION_UPDATE:
              set({ jobs: data.data.jobs });
              break;
            case MessageTypes.ERROR:
              set({ error: data.data.message });
              break;
            default:
              console.warn(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          set({ error: "Failed to parse server message" });
        }
      };

      ws.onclose = () => {
        set({ isConnected: false });
        // Attempt to reconnect after a short delay
        setTimeout(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            get().connect(existingSessionId);
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        set({ isConnected: false, error: "Connection error" });
      };
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      set({
        isConnecting: false,
        error: "Failed to connect to WebSocket server",
      });
    }
  },

  setClientId: (clientId: string) => {
    set({ clientId });
  },

  // Add a job to the session
  addJob: (jobId: string) => {
    const { sessionId } = get();
    if (!sessionId || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot add job - WebSocket not ready:", {
        sessionId,
        wsState: ws?.readyState,
      });
      return false;
    }
    ws.send(
      JSON.stringify({
        type: MessageTypes.ADD_JOB,
        jobId,
      }),
    );
    return true;
  },

  // Cancel a job
  cancelJob: (jobId: string) => {
    const { sessionId } = get();
    if (!sessionId || !ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(
      JSON.stringify({
        type: MessageTypes.CANCEL_JOB,
        jobId,
      }),
    );
    return true;
  },

  // Clear all jobs in the session
  clearAllJobs: () => {
    const { sessionId } = get();
    if (!sessionId || !ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(
      JSON.stringify({
        type: MessageTypes.CLEAR_SESSION,
      }),
    );
    return true;
  },
}));
