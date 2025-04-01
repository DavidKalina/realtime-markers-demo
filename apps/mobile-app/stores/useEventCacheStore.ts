import { create } from 'zustand';
import { EventType } from '@/types/types';

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

interface EventsCache {
    events: EventType[];
    timestamp: number;
    hasMore: boolean;
    cursor?: string;
}

interface EventCacheState {
    eventCache: Map<string, { event: EventType; timestamp: number }>;
    clusterNameCache: Map<string, ClusterNameCache>;
    savedEventsCache: EventsCache | null;
    discoveredEventsCache: EventsCache | null;
    getCachedEvent: (id: string) => EventType | null;
    setCachedEvent: (id: string, event: EventType, ttlSeconds?: number) => void;
    getCachedClusterName: (clusterId: string) => { name: string; geocodingInfo?: GeocodingInfo } | null;
    setCachedClusterName: (clusterId: string, name: string, geocodingInfo?: GeocodingInfo) => void;
    getCachedSavedEvents: () => EventsCache | null;
    setCachedSavedEvents: (events: EventType[], hasMore: boolean, cursor?: string) => void;
    getCachedDiscoveredEvents: () => EventsCache | null;
    setCachedDiscoveredEvents: (events: EventType[], hasMore: boolean, cursor?: string) => void;
    clearCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useEventCacheStore = create<EventCacheState>((set, get) => ({
    eventCache: new Map(),
    clusterNameCache: new Map(),
    savedEventsCache: null,
    discoveredEventsCache: null,

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
            geocodingInfo: cached.geocodingInfo
        };
    },

    setCachedClusterName: (clusterId: string, name: string, geocodingInfo?: GeocodingInfo) => {
        const { clusterNameCache } = get();
        const newCache = new Map(clusterNameCache);
        newCache.set(clusterId, {
            name,
            geocodingInfo,
            timestamp: Date.now(),
        });
        set({ clusterNameCache: newCache });
    },

    getCachedSavedEvents: () => {
        const { savedEventsCache } = get();
        if (!savedEventsCache) return null;

        if (Date.now() - savedEventsCache.timestamp > CACHE_TTL) {
            set({ savedEventsCache: null });
            return null;
        }

        return savedEventsCache;
    },

    setCachedSavedEvents: (events: EventType[], hasMore: boolean, cursor?: string) => {
        set({
            savedEventsCache: {
                events,
                hasMore,
                cursor,
                timestamp: Date.now(),
            }
        });
    },

    getCachedDiscoveredEvents: () => {
        const { discoveredEventsCache } = get();
        if (!discoveredEventsCache) return null;

        if (Date.now() - discoveredEventsCache.timestamp > CACHE_TTL) {
            set({ discoveredEventsCache: null });
            return null;
        }

        return discoveredEventsCache;
    },

    setCachedDiscoveredEvents: (events: EventType[], hasMore: boolean, cursor?: string) => {
        set({
            discoveredEventsCache: {
                events,
                hasMore,
                cursor,
                timestamp: Date.now(),
            }
        });
    },

    clearCache: () => {
        set({
            eventCache: new Map(),
            clusterNameCache: new Map(),
            savedEventsCache: null,
            discoveredEventsCache: null,
        });
    },
})); 