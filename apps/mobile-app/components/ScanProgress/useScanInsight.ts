import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useDialogStreamer,
  splitIntoPages,
  CHARS_PER_PAGE,
} from "../AreaScan/AreaScanComponents";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import type { TrackedJob } from "@/hooks/useJobProgress";

function formatEventDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

export function useScanInsight(onDismissExternal?: () => void, active: boolean = true) {
  const { activeJobs, dismissJob } = useJobProgressContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingPagesRef = useRef<string[] | null>(null);
  const handledJobRef = useRef<string | null>(null);
  const onDismissExternalRef = useRef(onDismissExternal);
  onDismissExternalRef.current = onDismissExternal;

  // Pick display job: latest in-flight, or latest overall
  const displayJob = useMemo<TrackedJob | undefined>(() => {
    if (activeJobs.length === 0) return undefined;
    const inFlight = activeJobs.filter(
      (j) => j.status === "pending" || j.status === "processing",
    );
    return inFlight.length > 0
      ? inFlight[inFlight.length - 1]
      : activeJobs[activeJobs.length - 1];
  }, [activeJobs]);

  const visible = activeJobs.length > 0;
  const jobIdRef = useRef<string | undefined>(undefined);
  jobIdRef.current = displayJob?.jobId;

  // Stable identity — always reads latest jobId via ref
  const handleDismiss = useCallback(() => {
    onDismissExternalRef.current?.();
    if (jobIdRef.current) {
      dismissJob(jobIdRef.current);
    }
  }, [dismissJob]);

  const dialog = useDialogStreamer(handleDismiss, active);

  const feedPending = useCallback(() => {
    if (pendingPagesRef.current) {
      dialog.feedPages(pendingPagesRef.current);
      pendingPagesRef.current = null;
    }
  }, [dialog.feedPages]);

  // React to job state changes
  useEffect(() => {
    if (!displayJob) {
      setIsLoading(false);
      setError(null);
      handledJobRef.current = null;
      return;
    }

    const { status } = displayJob;
    const isInFlight = status === "pending" || status === "processing";

    if (isInFlight) {
      setIsLoading(true);
      setError(null);
      handledJobRef.current = null;
      return;
    }

    // Terminal state — only compose once per job
    if (handledJobRef.current === displayJob.jobId) return;
    handledJobRef.current = displayJob.jobId;

    setIsLoading(false);

    if (status === "failed") {
      setError(displayJob.error || "Processing failed");
      return;
    }

    // Completed — compose result text
    const result = displayJob.result;
    const extractions = displayJob.extractions;
    const eventCreated =
      (result?.eventId && !result?.isDuplicate) || result?.isMultiEvent;
    const resultMessage = (result?.message as string) || "Event Created";

    let text: string;
    if (eventCreated && extractions) {
      const parts: string[] = [];
      const titleLine = [extractions.emoji, extractions.title]
        .filter(Boolean)
        .join(" ");
      if (titleLine) parts.push(titleLine);
      const formattedDate = extractions.date
        ? formatEventDate(extractions.date)
        : undefined;
      const detailLine = [formattedDate, extractions.address]
        .filter(Boolean)
        .join(" · ");
      if (detailLine) parts.push(detailLine);
      if (extractions.categories && extractions.categories.length > 0) {
        parts.push(extractions.categories.join(" · "));
      }
      parts.push(resultMessage);
      text = parts.join("\n");
    } else {
      text = resultMessage;
    }

    pendingPagesRef.current = splitIntoPages(text, CHARS_PER_PAGE);
  }, [displayJob]);

  // Fly-to coordinates
  const flyToCoordinates = useMemo<[number, number] | undefined>(() => {
    if (!displayJob) return undefined;
    const result = displayJob.result;
    const eventCreated =
      (result?.eventId && !result?.isDuplicate) || result?.isMultiEvent;
    if (eventCreated && result?.coordinates) {
      return result.coordinates as [number, number];
    }
    return undefined;
  }, [displayJob]);

  // Current step label for loading text
  const loadingText = displayJob?.stepLabel ?? "Processing flyer";

  return {
    isLoading,
    error,
    dialog,
    feedPending,
    visible,
    flyToCoordinates,
    loadingText,
    jobKey: jobIdRef.current ?? "none",
  };
}
