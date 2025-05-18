import { create } from "zustand";
import { EventType } from "@/types/types";

interface GeocodingInfo {
  placeName: string;
  neighborhood?: string;
  locality?: string;
  place?: string;
  region?: string;
}

interface ClusterNameCache {
  name: string;
  geocodingInfo?: GeocodingInfo;
  timestamp: number;
}

interface EventCacheState {
  eventCache: Map<string, { event: EventType; timestamp: number }>;
  clusterNameCache: Map<string, ClusterNameCache>;
  getCachedEvent: (id: string) => EventType | null;
  setCachedEvent: (id: string, event: EventType, ttlSeconds?: number) => void;
  getCachedClusterName: (
    clusterId: string,
  ) => { name: string; geocodingInfo?: GeocodingInfo } | null;
  setCachedClusterName: (
    clusterId: string,
    name: string,
    geocodingInfo?: GeocodingInfo,
  ) => void;
  clearCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useEventCacheStore = create<EventCacheState>((set, get) => ({
  eventCache: new Map(),
  clusterNameCache: new Map(),

  getCachedEvent: (id: string) => {
    const { eventCache } = get();
    const cached = eventCache.get(id);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      const newCache = new Map(eventCache);
      newCache.delete(id);
      set({ eventCache: newCache });
      return null;
    }

    return cached.event;
  },

  setCachedEvent: (id: string, event: EventType, ttlSeconds: number = 3600) => {
    const { eventCache } = get();
    const newCache = new Map(eventCache);
    newCache.set(id, {
      event,
      timestamp: Date.now(),
    });
    set({ eventCache: newCache });
  },

  getCachedClusterName: (clusterId: string) => {
    const { clusterNameCache } = get();
    const cached = clusterNameCache.get(clusterId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      const newCache = new Map(clusterNameCache);
      newCache.delete(clusterId);
      set({ clusterNameCache: newCache });
      return null;
    }

    return {
      name: cached.name,
      geocodingInfo: cached.geocodingInfo,
    };
  },

  setCachedClusterName: (
    clusterId: string,
    name: string,
    geocodingInfo?: GeocodingInfo,
  ) => {
    const { clusterNameCache } = get();
    const newCache = new Map(clusterNameCache);
    newCache.set(clusterId, {
      name,
      geocodingInfo,
      timestamp: Date.now(),
    });
    set({ clusterNameCache: newCache });
  },

  clearCache: () => {
    set({
      eventCache: new Map(),
      clusterNameCache: new Map(),
    });
  },
}));
