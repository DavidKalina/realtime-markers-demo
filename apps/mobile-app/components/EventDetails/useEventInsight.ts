import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import {
  useDialogStreamer,
  splitIntoPages,
  CHARS_PER_PAGE,
} from "../AreaScan/AreaScanComponents";

export function useEventInsight(eventId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idle, setIdle] = useState(true);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const fetchedRef = useRef<string | null>(null);
  const pendingPagesRef = useRef<string[] | null>(null);

  const dialog = useDialogStreamer();

  const feedPending = useCallback(() => {
    if (pendingPagesRef.current) {
      dialog.feedPages(pendingPagesRef.current);
      pendingPagesRef.current = null;
    }
  }, [dialog.feedPages]);

  const fetchInsight = useCallback(() => {
    if (!eventId || fetchedRef.current === eventId) return;
    fetchedRef.current = eventId;

    setIdle(false);
    setIsLoading(true);
    setError(null);

    abortRef.current = apiClient.areaScan.streamEventInsight(eventId, {
      onMetadata: () => {
        // metadata received (contains { cached })
      },
      onContent: (text) => {
        setIsLoading(false);
        pendingPagesRef.current = splitIntoPages(text, CHARS_PER_PAGE);
      },
      onDone: () => {
        setIsLoading(false);
      },
      onError: (err) => {
        setIsLoading(false);
        setError(err.message || "Failed to load insight");
      },
    });
  }, [eventId]);

  // Reset when eventId changes
  useEffect(() => {
    fetchedRef.current = null;
    setIdle(true);
    setIsLoading(false);
    setError(null);
  }, [eventId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { isLoading, error, idle, dialog, feedPending, fetchInsight };
}
