// hooks/useJobSession.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

// Types
interface Job {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  progressStep: string;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionState {
  sessionId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  jobs: Job[];
}

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

export const useJobSession = (existingSessionId?: string) => {
  // State for the session
  const [state, setState] = useState<SessionState>({
    sessionId: existingSessionId || null,
    isConnected: false,
    isConnecting: false,
    error: null,
    jobs: [],
  });

  // Keep a ref to the WebSocket to use in callbacks
  const wsRef = useRef<WebSocket | null>(null);

  // Client ID for this connection
  const clientIdRef = useRef<string>(uuidv4());

  // Connect to the WebSocket server
  const connect = useCallback(async () => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Create WebSocket connection
      const ws = new WebSocket(`${process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:8081"}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, isConnecting: false }));

        // If we have an existing session ID, join it
        if (existingSessionId) {
          ws.send(
            JSON.stringify({
              type: MessageTypes.JOIN_SESSION,
              sessionId: existingSessionId,
            })
          );
        } else {
          // Otherwise, create a new session
          ws.send(
            JSON.stringify({
              type: MessageTypes.CREATE_SESSION,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case MessageTypes.SESSION_CREATED:
              setState((prev) => ({
                ...prev,
                sessionId: data.data.sessionId,
              }));
              break;

            case MessageTypes.SESSION_JOINED:
              setState((prev) => ({
                ...prev,
                sessionId: data.data.sessionId,
              }));
              break;

            case MessageTypes.SESSION_UPDATE:
              setState((prev) => ({
                ...prev,
                jobs: data.data.jobs,
              }));
              break;

            case MessageTypes.ERROR:
              setState((prev) => ({
                ...prev,
                error: data.data.message,
              }));
              break;

            default:
              console.warn(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false }));

        // Attempt to reconnect after a short delay
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: "Connection error",
        }));
      };
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: "Failed to connect",
      }));
    }
  }, [existingSessionId]);

  // Connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Add a job to the session
  const addJob = useCallback(
    (jobId: string) => {
      if (!state.sessionId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      wsRef.current.send(
        JSON.stringify({
          type: MessageTypes.ADD_JOB,
          jobId,
        })
      );

      return true;
    },
    [state.sessionId]
  );

  // Cancel a job
  const cancelJob = useCallback(
    (jobId: string) => {
      if (!state.sessionId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      wsRef.current.send(
        JSON.stringify({
          type: MessageTypes.CANCEL_JOB,
          jobId,
        })
      );

      return true;
    },
    [state.sessionId]
  );

  // Clear all jobs in the session
  const clearAllJobs = useCallback(() => {
    if (!state.sessionId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(
      JSON.stringify({
        type: MessageTypes.CLEAR_SESSION,
      })
    );

    return true;
  }, [state.sessionId]);

  // Derive additional state for easier consumption
  const activeJobs = state.jobs.filter(
    (job) => job.status === "pending" || job.status === "processing"
  );
  const completedJobs = state.jobs.filter((job) => job.status === "completed");
  const failedJobs = state.jobs.filter((job) => job.status === "failed");

  // Get the most recently active job
  const activeJob =
    activeJobs.length > 0
      ? activeJobs.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0]
      : null;

  return {
    // Connection state
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    reconnect: connect,

    // Session data
    sessionId: state.sessionId,

    // Job data
    jobs: state.jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    activeJob,

    // Job actions
    addJob,
    cancelJob,
    clearAllJobs,

    // Derived stats
    totalJobs: state.jobs.length,
    hasActiveJobs: activeJobs.length > 0,
  };
};
