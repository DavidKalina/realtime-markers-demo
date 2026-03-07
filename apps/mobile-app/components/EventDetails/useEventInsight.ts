import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import {
  useDialogStreamer,
  splitIntoPages,
  CHARS_PER_PAGE,
} from "../AreaScan/AreaScanComponents";

export function useEventInsight(eventId: string, active: boolean = true) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const fetchedRef = useRef<string | null>(null);
  const pendingPagesRef = useRef<string[] | null>(null);

  const onDismiss = useCallback(() => {}, []);
  const dialog = useDialogStreamer(onDismiss, active);

  const feedPending = useCallback(() => {
    if (pendingPagesRef.current) {
      dialog.feedPages(pendingPagesRef.current);
      pendingPagesRef.current = null;
    }
  }, [dialog.feedPages]);

  useEffect(() => {
    if (!eventId || fetchedRef.current === eventId) return;
    fetchedRef.current = eventId;

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

    return () => {
      abortRef.current?.abort();
    };
  }, [eventId]);

  return { isLoading, error, dialog, feedPending };
}
