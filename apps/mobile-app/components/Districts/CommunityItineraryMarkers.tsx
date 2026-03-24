import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import MapboxGL from "@rnmapbox/maps";
import { Delaunay } from "d3-delaunay";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { getDistrictColor } from "@/utils/districtUtils";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";

interface CommunityItineraryMarkersProps {
  dimmed?: boolean;
  hidden?: boolean;
  onSelect: (itinerary: BrowseItineraryPreview, districtId: string) => void;
  selectedId: string | null;
}

interface MarkerData {
  itinerary: BrowseItineraryPreview;
  districtId: string;
  coordinate: [number, number];
  emoji: string;
  borderColor: string;
}

/** Max markers to render as native views at once. */
const MAX_VISIBLE_MARKERS = 60;
/** New markers per chunk for progressive mounting on large batches. */
const CHUNK_SIZE = 12;
/** Stagger delay between each new marker entrance (ms). */
const STAGGER_DELAY_MS = 30;

// ---------------------------------------------------------------------------
// Single marker — handles entrance + exit + hidden animations
// ---------------------------------------------------------------------------

const CommunityMarkerPin = React.memo(
  ({
    marker,
    isSelected,
    onSelect,
    staggerIndex,
    dimmed,
    hidden,
    removing,
    onExitComplete,
  }: {
    marker: MarkerData;
    isSelected: boolean;
    onSelect: () => void;
    staggerIndex: number;
    dimmed: boolean;
    hidden: boolean;
    removing?: boolean;
    onExitComplete?: () => void;
  }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const hiddenOpacity = useSharedValue(hidden ? 0 : 1);
    const dimFactor = useDerivedValue(() => (dimmed ? 0.35 : 1));
    const isMounted = useRef(true);

    // Track mount state for safe callbacks
    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
        cancelAnimation(scale);
        cancelAnimation(opacity);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Entrance animation — runs once on mount
    useEffect(() => {
      const delay = staggerIndex * STAGGER_DELAY_MS;
      scale.value = withDelay(
        delay,
        withSpring(1, { damping: 10, stiffness: 180, mass: 0.8 }),
      );
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Exit animation — scale/fade out, then notify parent (data deletions only)
    const onExitCompleteRef = useRef(onExitComplete);
    onExitCompleteRef.current = onExitComplete;

    useEffect(() => {
      if (!removing) return;
      scale.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished && onExitCompleteRef.current && isMounted.current) {
          scheduleOnRN(onExitCompleteRef.current);
        }
      });
    }, [removing]); // eslint-disable-line react-hooks/exhaustive-deps

    // Hidden toggle — fade without re-entrance spring
    useEffect(() => {
      hiddenOpacity.value = withTiming(hidden ? 0 : 1, { duration: 250 });
    }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps

    const animStyle = useAnimatedStyle(() => ({
      opacity: opacity.value * hiddenOpacity.value * dimFactor.value,
      transform: [{ scale: scale.value }],
    }));

    return (
      <MapboxGL.MarkerView
        key={marker.itinerary.id}
        id={`community-${marker.itinerary.id}`}
        coordinate={marker.coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        allowOverlap={false}
      >
        <Animated.View style={animStyle}>
          <View
            style={[
              styles.marker,
              { borderColor: marker.borderColor },
              isSelected && styles.markerSelected,
            ]}
            onTouchEnd={hidden || removing ? undefined : onSelect}
          >
            <Text style={styles.emoji}>{marker.emoji}</Text>
          </View>
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
);

// ---------------------------------------------------------------------------
// Main component — viewport culling + staggered mount + exit queue
// ---------------------------------------------------------------------------

const DEFAULT_BORDER_COLOR = "#86efac";

const CommunityItineraryMarkersInner: React.FC<
  CommunityItineraryMarkersProps
> = ({ dimmed = false, hidden = false, onSelect, selectedId }) => {
  const streamedItineraries = useDistrictMapStore(
    (s) => s.streamedItineraries,
  );
  const districts = useDistrictMapStore((s) => s.districts);
  const mapViewport = useLocationStore((s) => s.mapViewport);

  // Track which markers are already mounted so re-renders don't re-stagger
  const mountedIds = useRef(new Set<string>());

  // Exit animation queue — only for DATA deletions (not viewport culling).
  // Keeping exiting MarkerViews alive while new ones mount causes native
  // assertion failures in RNMBXMapView.insertReactSubview.
  const removingMarkers = useRef(new Map<string, MarkerData>());
  const [exitTick, setExitTick] = useState(0);
  const prevAllMarkerIds = useRef(new Set<string>());

  // Progressive mounting for large initial batches
  const [mountedChunkCount, setMountedChunkCount] = useState(0);
  const chunkingActive = useRef(false);

  // Build a Delaunay lookup from district centroids for point → district mapping
  const districtLookup = useMemo(() => {
    if (districts.length === 0) return null;
    const sorted = [...districts].sort((a, b) => a.id.localeCompare(b.id));
    const points: [number, number][] = sorted.map((d) => [
      d.centroidLng,
      d.centroidLat,
    ]);
    const delaunay = Delaunay.from(points);
    return { delaunay, sorted };
  }, [districts]);

  // Streamed itineraries from WebSocket — the only data source
  // Wait for districts so every marker gets a proper cluster assignment
  const allMarkers = useMemo((): MarkerData[] => {
    if (!districtLookup) return [];
    return streamedItineraries
      .filter((itin) => itin.entryLatitude && itin.entryLongitude)
      .map((itin) => {
        const lng = itin.entryLongitude!;
        const lat = itin.entryLatitude!;

        let districtId = "";
        let borderColor = DEFAULT_BORDER_COLOR;

        const idx = districtLookup.delaunay.find(lng, lat);
        const district = districtLookup.sorted[idx];
        if (district) {
          districtId = district.id;
          borderColor = getDistrictColor(district);
        }

        return {
          itinerary: itin,
          districtId,
          coordinate: [lng, lat] as [number, number],
          emoji: itin.items?.[0]?.emoji ?? "\u{1F4CD}",
          borderColor,
        };
      });
  }, [streamedItineraries, districtLookup]);

  // Cache marker data so we can look up deleted markers for exit animation.
  // This ref is updated AFTER exit detection so deleted markers are still available.
  const allMarkersMap = useRef(new Map<string, MarkerData>());

  // Detect DATA deletions (marker removed from allMarkers entirely).
  // Only these get exit animations — viewport culling just unmounts instantly,
  // because keeping exiting MarkerViews alive during panning causes native
  // assertion failures in RNMBXMapView.insertReactSubview.
  const allMarkerIds = useMemo(
    () => new Set(allMarkers.map((m) => m.itinerary.id)),
    [allMarkers],
  );

  // Callback for when a marker finishes its exit animation
  const handleExitComplete = useCallback((id: string) => {
    removingMarkers.current.delete(id);
    mountedIds.current.delete(id);
    setExitTick((t) => t + 1);
  }, []);

  // Queue deleted markers for exit animation, then update cache
  useEffect(() => {
    let changed = false;

    // Markers that disappeared from data → exit animation
    for (const id of prevAllMarkerIds.current) {
      if (!allMarkerIds.has(id) && !removingMarkers.current.has(id)) {
        const cachedMarker = allMarkersMap.current.get(id);
        if (cachedMarker) {
          removingMarkers.current.set(id, cachedMarker);
          changed = true;
        }
      }
    }

    // Markers that came back → cancel exit
    for (const id of allMarkerIds) {
      if (removingMarkers.current.has(id)) {
        removingMarkers.current.delete(id);
        changed = true;
      }
    }

    prevAllMarkerIds.current = allMarkerIds;

    // NOW update the cache (after we've used the old data for lookups)
    allMarkersMap.current.clear();
    for (const m of allMarkers) {
      allMarkersMap.current.set(m.itinerary.id, m);
    }

    if (changed) {
      setExitTick((t) => t + 1);
    }
  }, [allMarkerIds, allMarkers]);

  // Viewport culling with 10% buffer + hard cap at MAX_VISIBLE_MARKERS
  const visibleMarkers = useMemo(() => {
    if (!mapViewport) return allMarkers.slice(0, MAX_VISIBLE_MARKERS);

    const lngSpan = mapViewport.east - mapViewport.west;
    const latSpan = mapViewport.north - mapViewport.south;
    const lngBuffer = lngSpan * 0.1;
    const latBuffer = latSpan * 0.1;

    const centerLng = (mapViewport.east + mapViewport.west) / 2;
    const centerLat = (mapViewport.north + mapViewport.south) / 2;

    const inViewport = allMarkers.filter((m) => {
      if (m.itinerary.id === selectedId) return true;
      const [lng, lat] = m.coordinate;
      return (
        lng >= mapViewport.west - lngBuffer &&
        lng <= mapViewport.east + lngBuffer &&
        lat >= mapViewport.south - latBuffer &&
        lat <= mapViewport.north + latBuffer
      );
    });

    // Cap at MAX_VISIBLE_MARKERS, prioritizing closest to center
    if (inViewport.length > MAX_VISIBLE_MARKERS) {
      inViewport.sort((a, b) => {
        const dA =
          (a.coordinate[0] - centerLng) ** 2 +
          (a.coordinate[1] - centerLat) ** 2;
        const dB =
          (b.coordinate[0] - centerLng) ** 2 +
          (b.coordinate[1] - centerLat) ** 2;
        return dA - dB;
      });
      return inViewport.slice(0, MAX_VISIBLE_MARKERS);
    }

    return inViewport;
  }, [allMarkers, mapViewport, selectedId]);

  // Assign stagger indices — only new (unmounted) markers get staggered
  const staggerResult = useMemo(() => {
    let newCount = 0;
    const result = visibleMarkers.map((m) => {
      const alreadyMounted = mountedIds.current.has(m.itinerary.id);
      const staggerIndex = alreadyMounted ? 0 : newCount++;
      return { marker: m, staggerIndex, removing: false as const };
    });

    // Update mounted set
    const currentIds = new Set(visibleMarkers.map((m) => m.itinerary.id));
    for (const id of mountedIds.current) {
      if (!currentIds.has(id)) mountedIds.current.delete(id);
    }
    for (const id of currentIds) {
      mountedIds.current.add(id);
    }

    return { items: result, newCount };
  }, [visibleMarkers]);

  // Progressive chunking — schedule via useEffect (not inside useMemo)
  useEffect(() => {
    if (staggerResult.newCount <= CHUNK_SIZE || chunkingActive.current) return;

    chunkingActive.current = true;
    setMountedChunkCount(1);

    const totalChunks = Math.ceil(staggerResult.newCount / CHUNK_SIZE);
    let chunk = 1;
    const scheduleNext = () => {
      chunk++;
      if (chunk <= totalChunks) {
        InteractionManager.runAfterInteractions(() => {
          setMountedChunkCount(chunk);
          scheduleNext();
        });
      } else {
        chunkingActive.current = false;
      }
    };
    InteractionManager.runAfterInteractions(scheduleNext);
  }, [staggerResult]);

  // Build final render list: visible markers + data-deleted markers animating out
  const renderList = useMemo(() => {
    let list = staggerResult.items;

    // Apply chunking limit for large initial batches
    if (chunkingActive.current) {
      const maxIndex = mountedChunkCount * CHUNK_SIZE;
      list = list.filter(
        (item) => item.staggerIndex === 0 || item.staggerIndex < maxIndex,
      );
    }

    // Append data-deleted markers that are animating out (NOT viewport-culled ones)
    const exitItems = Array.from(
      removingMarkers.current.values(),
    ).map((marker) => ({
      marker,
      staggerIndex: 0,
      removing: true as const,
    }));

    return [...list, ...exitItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staggerResult, mountedChunkCount, exitTick]);

  if (renderList.length === 0) return null;

  return (
    <>
      {renderList.map(({ marker, staggerIndex, removing }) => (
        <CommunityMarkerPin
          key={marker.itinerary.id}
          marker={marker}
          isSelected={marker.itinerary.id === selectedId}
          onSelect={() => onSelect(marker.itinerary, marker.districtId)}
          staggerIndex={staggerIndex}
          dimmed={dimmed}
          hidden={hidden}
          removing={removing}
          onExitComplete={
            removing
              ? () => handleExitComplete(marker.itinerary.id)
              : undefined
          }
        />
      ))}
    </>
  );
};

export const CommunityItineraryMarkers = React.memo(
  CommunityItineraryMarkersInner,
);

const styles = StyleSheet.create({
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(26, 26, 26, 0.85)",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  markerSelected: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    shadowColor: "#86efac",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 16,
    textAlign: "center",
  },
});
