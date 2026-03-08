import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import {
  useDialogStreamer,
  splitIntoPages,
} from "../AreaScan/AreaScanComponents";

const CITY_CHARS_PER_PAGE = 110;

export function useCityInsight(city: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!city || fetchedRef.current === city) return;
    fetchedRef.current = city;

    setIsLoading(true);
    setError(null);

    abortRef.current = apiClient.areaScan.streamCityInsight(city, {
      onMetadata: () => {},
      onContent: (text) => {
        setIsLoading(false);
        pendingPagesRef.current = splitIntoPages(text, CITY_CHARS_PER_PAGE);
      },
      onDone: () => {
        setIsLoading(false);
      },
      onError: (err) => {
        setIsLoading(false);
        setError(err.message || "Failed to load city insight");
      },
    });

    return () => {
      abortRef.current?.abort();
    };
  }, [city]);

  return { isLoading, error, dialog, feedPending };
}
