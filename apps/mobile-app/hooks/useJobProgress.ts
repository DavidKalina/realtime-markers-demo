import { useCallback, useEffect, useRef, useState } from "react";
import EventSource from "react-native-sse";
import { apiClient } from "@/services/ApiClient";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface JobExtractions {
  title?: string;
  emoji?: string;
  emojiDescription?: string;
  date?: string;
  address?: string;
  categories?: string[];
  confidence?: number;
}

export interface TrackedJob {
  jobId: string;
  status: JobStatus;
  progress: number;
  stepLabel: string;
  extractions?: JobExtractions;
  result?: Record<string, unknown>;
  error?: string;
}

export interface UseJobProgressReturn {
  activeJobs: TrackedJob[];
  activeCount: number;
  trackJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
}

const AUTO_DISMISS_MS = 5000;

export function useJobProgress(): UseJobProgressReturn {
  const [jobs, setJobs] = useState<Map<string, TrackedJob>>(new Map());
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const es of eventSourcesRef.current.values()) {
        es.close();
      }
      eventSourcesRef.current.clear();
      for (const timer of dismissTimersRef.current.values()) {
        clearTimeout(timer);
      }
      dismissTimersRef.current.clear();
    };
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => {
      const next = new Map(prev);
      next.delete(jobId);
      return next;
    });
    const es = eventSourcesRef.current.get(jobId);
    if (es) {
      es.close();
      eventSourcesRef.current.delete(jobId);
    }
    const timer = dismissTimersRef.current.get(jobId);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(jobId);
    }
  }, []);

  const trackJob = useCallback(
    (jobId: string) => {
      // Don't track the same job twice
      if (eventSourcesRef.current.has(jobId)) return;

      // Add initial tracked job
      setJobs((prev) => {
        const next = new Map(prev);
        next.set(jobId, {
          jobId,
          status: "pending",
          progress: 0,
          stepLabel: "Starting",
        });
        return next;
      });

      // Open SSE connection
      (async () => {
        const token = await apiClient.getAccessToken();
        if (!token) {
          console.error(
            "[useJobProgress] No access token available for SSE stream",
          );
          return;
        }

        const baseUrl = apiClient.baseUrl;
        const url = `${baseUrl}/api/jobs/${jobId}/stream?token=${encodeURIComponent(token)}`;

        const es = new EventSource(url);
        eventSourcesRef.current.set(jobId, es);

        es.addEventListener("message", (event) => {
          if (!event.data) return;
          try {
            const data = JSON.parse(event.data as string);

            setJobs((prev) => {
              const next = new Map(prev);
              const existing = next.get(jobId);
              const incomingExtractions =
                data.extractions ||
                data.progressDetails?.extractions ||
                undefined;
              next.set(jobId, {
                jobId,
                status: data.status || existing?.status || "processing",
                progress: data.progress ?? existing?.progress ?? 0,
                stepLabel:
                  data.progressStep ||
                  data.stepLabel ||
                  existing?.stepLabel ||
                  "Processing",
                extractions: incomingExtractions
                  ? { ...existing?.extractions, ...incomingExtractions }
                  : existing?.extractions,
                result: data.result || existing?.result,
                error: data.error || existing?.error,
              });
              return next;
            });

            // Auto-dismiss on terminal status
            if (data.status === "completed" || data.status === "failed") {
              const timer = setTimeout(() => {
                dismissJob(jobId);
              }, AUTO_DISMISS_MS);
              dismissTimersRef.current.set(jobId, timer);
            }
          } catch (e) {
            console.error("[useJobProgress] Error parsing SSE data:", e);
          }
        });

        es.addEventListener("done", () => {
          es.close();
          eventSourcesRef.current.delete(jobId);
        });

        es.addEventListener("error", (event) => {
          console.error("[useJobProgress] SSE error:", event);
          // Don't reconnect — the backend will close when done
        });
      })();
    },
    [dismissJob],
  );

  const activeJobs = Array.from(jobs.values());
  const activeCount = activeJobs.filter(
    (j) => j.status === "pending" || j.status === "processing",
  ).length;

  return { activeJobs, activeCount, trackJob, dismissJob };
}
