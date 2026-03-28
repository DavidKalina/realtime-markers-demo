import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useJobProgress,
  type UseJobProgressReturn,
} from "@/hooks/useJobProgress";

export interface JobProgressContextValue extends UseJobProgressReturn {
  /** True when there's a pending/processing job */
  isGenerating: boolean;
  /** The currently active job ID (first pending/processing), or null */
  activeJobId: string | null;
  /** The itinerary ID for the active job, or null */
  activeItineraryId: string | null;
  /** Step label from the active job */
  stepLabel: string;
  /** True when a job completed and user hasn't cleared it yet */
  hasReady: boolean;
  /** Clear the hasReady flag */
  clearReady: () => void;
}

const JobProgressContext = createContext<JobProgressContextValue | null>(null);

export function JobProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const jobProgress = useJobProgress();
  const [hasReady, setHasReady] = useState(false);
  const seenCompletedRef = useRef<Set<string>>(new Set());

  // Detect when a tracked job transitions to "completed"
  useEffect(() => {
    for (const job of jobProgress.activeJobs) {
      if (
        job.status === "completed" &&
        !seenCompletedRef.current.has(job.jobId)
      ) {
        seenCompletedRef.current.add(job.jobId);
        setHasReady(true);
      }
    }
  }, [jobProgress.activeJobs]);

  const clearReady = useCallback(() => setHasReady(false), []);

  // Derive active job state from tracked jobs
  const activeJob = useMemo(
    () =>
      jobProgress.activeJobs.find(
        (j) => j.status === "pending" || j.status === "processing",
      ),
    [jobProgress.activeJobs],
  );

  const value = useMemo<JobProgressContextValue>(
    () => ({
      ...jobProgress,
      isGenerating: !!activeJob,
      activeJobId: activeJob?.jobId ?? null,
      activeItineraryId: activeJob?.itineraryId ?? null,
      stepLabel: activeJob?.stepLabel ?? "",
      hasReady,
      clearReady,
    }),
    [jobProgress, activeJob, hasReady, clearReady],
  );

  return (
    <JobProgressContext.Provider value={value}>
      {children}
    </JobProgressContext.Provider>
  );
}

export function useJobProgressContext(): JobProgressContextValue {
  const ctx = useContext(JobProgressContext);
  if (!ctx) {
    throw new Error(
      "useJobProgressContext must be used within a JobProgressProvider",
    );
  }
  return ctx;
}
