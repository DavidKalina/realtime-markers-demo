import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface AreaScanMetadata {
  zoneName: string;
  eventCount: number;
  topEmoji: string;
  categoryBreakdown: { name: string; count: number; pct: number }[];
  timeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  totalSaves: number;
  totalViews: number;
  avgDistance: number;
  recurringCount: number;
  events: {
    id: string;
    emoji: string;
    title: string;
    eventDate: string;
    distance: number;
    categoryNames: string;
  }[];
  trails: {
    id: number;
    name: string;
    surface: string;
    lengthMeters: number;
    lit: boolean | null;
    geometry: [number, number][];
    center: [number, number];
  }[];
}

export interface AreaScanCallbacks {
  onMetadata: (metadata: AreaScanMetadata) => void;
  onContent: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

function parseSSE(text: string, callbacks: AreaScanCallbacks): void {
  let currentEvent = "";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      currentEvent = "";
      continue;
    }
    if (trimmed.startsWith("event:")) {
      currentEvent = trimmed.slice(6).trim();
    } else if (trimmed.startsWith("data:")) {
      // Preserve leading spaces in data (LLM tokens like " the")
      const data = trimmed.slice(trimmed.startsWith("data: ") ? 6 : 5);

      switch (currentEvent) {
        case "metadata":
          try {
            callbacks.onMetadata(JSON.parse(data));
          } catch {
            // Ignore parse errors
          }
          break;
        case "content":
          callbacks.onContent(data);
          break;
        case "done":
          callbacks.onDone();
          break;
        case "error":
          try {
            const errData = JSON.parse(data);
            callbacks.onError(new Error(errData.error || "Stream error"));
          } catch {
            callbacks.onError(new Error("Stream error"));
          }
          break;
      }
    }
  }
}

export interface EventInsightCallbacks {
  onMetadata: (metadata: { cached: boolean }) => void;
  onContent: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

function parseEventInsightSSE(
  text: string,
  callbacks: EventInsightCallbacks,
): void {
  let currentEvent = "";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      currentEvent = "";
      continue;
    }
    if (trimmed.startsWith("event:")) {
      currentEvent = trimmed.slice(6).trim();
    } else if (trimmed.startsWith("data:")) {
      const data = trimmed.slice(trimmed.startsWith("data: ") ? 6 : 5);

      switch (currentEvent) {
        case "metadata":
          try {
            callbacks.onMetadata(JSON.parse(data));
          } catch {
            // Ignore parse errors
          }
          break;
        case "content":
          callbacks.onContent(data);
          break;
        case "done":
          callbacks.onDone();
          break;
        case "error":
          try {
            const errData = JSON.parse(data);
            callbacks.onError(new Error(errData.error || "Stream error"));
          } catch {
            callbacks.onError(new Error("Stream error"));
          }
          break;
      }
    }
  }
}

export class AreaScanModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  streamAreaProfile(
    lat: number,
    lng: number,
    radius: number,
    callbacks: AreaScanCallbacks,
  ): { abort: () => void } {
    const abortController = new AbortController();

    this.fetchWithAuth(`${this.client.baseUrl}/api/area-scan`, {
      method: "POST",
      body: JSON.stringify({ lat, lng, radius }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Area scan failed: ${response.status}`,
          );
        }

        // RN fetch doesn't support ReadableStream — read full text then parse SSE
        const text = await response.text();
        parseSSE(text, callbacks);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        callbacks.onError(error);
      });

    return {
      abort: () => abortController.abort(),
    };
  }

  streamClusterProfile(
    eventIds: string[],
    lat: number,
    lng: number,
    callbacks: AreaScanCallbacks,
  ): { abort: () => void } {
    const abortController = new AbortController();

    this.fetchWithAuth(`${this.client.baseUrl}/api/area-scan/cluster`, {
      method: "POST",
      body: JSON.stringify({ eventIds, lat, lng }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Cluster profile failed: ${response.status}`,
          );
        }

        const text = await response.text();
        parseSSE(text, callbacks);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        callbacks.onError(error);
      });

    return {
      abort: () => abortController.abort(),
    };
  }

  streamCityInsight(
    city: string,
    callbacks: EventInsightCallbacks,
  ): { abort: () => void } {
    const abortController = new AbortController();

    this.fetchWithAuth(`${this.client.baseUrl}/api/area-scan/city`, {
      method: "POST",
      body: JSON.stringify({ city }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `City insight failed: ${response.status}`,
          );
        }

        const data = await response.json();
        callbacks.onMetadata({ cached: data.cached });
        callbacks.onContent(data.text);
        callbacks.onDone();
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        callbacks.onError(error);
      });

    return {
      abort: () => abortController.abort(),
    };
  }

  async fetchTrailDetail(trailId: number): Promise<{
    id: number;
    name: string;
    surface: string;
    lengthMeters: number;
    lit: boolean | null;
    geometry: [number, number][];
    center: [number, number];
  } | null> {
    try {
      const response = await this.fetchWithAuth(
        `${this.client.baseUrl}/api/area-scan/trail/${trailId}`,
      );
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  streamEventInsight(
    eventId: string,
    callbacks: EventInsightCallbacks,
  ): { abort: () => void } {
    const abortController = new AbortController();

    this.fetchWithAuth(`${this.client.baseUrl}/api/area-scan/event`, {
      method: "POST",
      body: JSON.stringify({ eventId }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Event insight failed: ${response.status}`,
          );
        }

        const data = await response.json();
        callbacks.onMetadata({ cached: data.cached });
        callbacks.onContent(data.text);
        callbacks.onDone();
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        callbacks.onError(error);
      });

    return {
      abort: () => abortController.abort(),
    };
  }
}
