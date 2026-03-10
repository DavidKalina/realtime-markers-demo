import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/ApiClient";
import type { AreaScanMetadata } from "@/services/api/modules/areaScan";
import {
  useDialogStreamer,
  splitIntoPages,
  CHARS_PER_PAGE,
  getRadiusForZoom,
} from "./AreaScanComponents";

export function useAreaInsight(
  lat: string | undefined,
  lng: string | undefined,
  zoom: string | undefined,
) {
  const [zoneStats, setZoneStats] = useState<AreaScanMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const fullTextRef = useRef("");
  const pendingPagesRef = useRef<string[] | null>(null);
  const fedPagesRef = useRef<string[] | null>(null);

  const dialog = useDialogStreamer();

  const feedPending = useCallback(() => {
    if (pendingPagesRef.current) {
      fedPagesRef.current = pendingPagesRef.current;
      dialog.feedPages(pendingPagesRef.current);
      pendingPagesRef.current = null;
    }
  }, [dialog.feedPages]);

  const refeedOnFocus = useCallback(() => {
    if (fedPagesRef.current && dialog.pages.length === 0) {
      dialog.feedPages(fedPagesRef.current);
    }
  }, [dialog.feedPages, dialog.pages.length]);

  useEffect(() => {
    if (!lat || !lng) return;

    const radius = getRadiusForZoom(zoom ? parseFloat(zoom) : 12);

    const handle = apiClient.areaScan.streamAreaProfile(
      parseFloat(lat),
      parseFloat(lng),
      radius,
      {
        onMetadata: (meta) => setZoneStats(meta),
        onContent: (chunk) => {
          fullTextRef.current += chunk;
        },
        onDone: () => {
          setIsLoading(false);
          if (fullTextRef.current) {
            pendingPagesRef.current = splitIntoPages(
              fullTextRef.current,
              CHARS_PER_PAGE,
            );
          }
        },
        onError: (err) => {
          setError(err.message);
          setIsLoading(false);
        },
      },
    );
    abortRef.current = handle;

    return () => {
      handle.abort();
    };
  }, [lat, lng]);

  return { zoneStats, isLoading, error, dialog, feedPending, refeedOnFocus };
}
