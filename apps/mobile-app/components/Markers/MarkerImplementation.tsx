// components/Markers/ClusteredMapMarkers.tsx
//
// View-pool approach: pre-mount a fixed number of MarkerView slots with stable
// keys so RNMBXMapView.insertReactSubview is only called once (on initial mount).
// After that, we update coordinates and content on existing slots — no child
// additions or removals on the native MapView, which avoids the Fabric legacy
// interop assertion crash.
import {
  ClusterFeature,
  PointFeature,
  useMarkerClustering,
} from "@/hooks/useMarkerClustering";
import { useLocationStore } from "@/stores/useLocationStore";
import { Marker, MapboxViewport } from "@/types/types";
import type { MarkerItem, ClusterItem } from "@/types/map";
import { getDominantCategory } from "@/utils/categoryColors";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useMemo, useEffect, useRef } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";
import { ClusterMarker } from "./ClusterMarker";
import { EmojiMapMarker } from "./CustomMapMarker";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  eventBroker,
  EventTypes,
  type CameraAnimateToLocationEvent,
} from "@/services/EventBroker";

interface ClusteredMapMarkersProps {
  markers?: Marker[];
  currentZoom?: number;
  viewport: MapboxViewport;
}

// Maximum number of MarkerView slots pre-mounted inside the MapView.
// The native view tree never grows or shrinks past this count after initial mount,
// preventing insertReactSubview crashes.
const MAX_POOL_SIZE = 50;

// Only animate entrance for new markers when the batch is small enough
// to feel magical rather than chaotic.
const ANIMATION_BUDGET = 20;

// Offscreen coordinate used for inactive pool slots. Latitude 90 (North Pole)
// ensures MarkerView is never visible regardless of viewport.
const OFFSCREEN: [number, number] = [0, 90];

const DOUBLE_TAP_WINDOW = 300;
// ---------------------------------------------------------------------------
// Slot content components — rendered INSIDE a pre-mounted MarkerView slot
// ---------------------------------------------------------------------------

const MarkerSlotContent = React.memo(
  ({
    marker,
    isSelected,
    onSelect,
    onNavigate,
    index,
    breathingScale,
    isNew,
    newIndex,
    staggerDelay,
    seenHapticIds,
  }: {
    marker: MarkerItem;
    isSelected: boolean;
    onSelect: () => void;
    onNavigate: () => void;
    index: number;
    breathingScale: SharedValue<number>;
    isNew: boolean;
    newIndex: number;
    staggerDelay: number;
    seenHapticIds: React.MutableRefObject<Set<string>>;
  }) => {
    const lastTapRef = useRef(0);

    const handlePress = useCallback(() => {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_WINDOW) {
        lastTapRef.current = 0;
        onNavigate();
      } else {
        lastTapRef.current = now;
        onSelect();
      }
    }, [onSelect, onNavigate]);

    // Haptic feedback — only for genuinely new markers (from WebSocket),
    // not for markers reappearing due to zoom/recluster.
    const hasPlayedHaptic = useRef(false);
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (!isNew || hasPlayedHaptic.current) return;
      if (seenHapticIds.current.has(marker.id)) return;
      if (seenHapticIds.current.size >= 3) return;
      hasPlayedHaptic.current = true;
      seenHapticIds.current.add(marker.id);
      const hapticDelay = Math.min(newIndex, 5) * staggerDelay;
      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, hapticDelay);
      return () => clearTimeout(timer);
    }, [newIndex, marker.id, seenHapticIds, isNew, staggerDelay]);

    // Entrance animation — only for genuinely new markers (first time on map).
    // Recluster/viewport re-entry: instant show, no animation (avoids popping).
    const dropY = useSharedValue(isNew ? -30 : 0);
    const dropScale = useSharedValue(isNew ? 0.2 : 1);
    const dropOpacity = useSharedValue(isNew ? 0 : 1);
    const hasAnimated = useRef(false);

    useEffect(() => {
      if (hasAnimated.current) {
        // Slot reused for a different marker — instant show, no animation
        dropY.value = 0;
        dropScale.value = 1;
        dropOpacity.value = 1;
        return;
      }
      hasAnimated.current = true;

      if (isNew) {
        // Full pin-drop for brand new markers only
        const delay = Math.min(newIndex, 5) * staggerDelay;
        dropOpacity.value = withDelay(delay, withTiming(1, { duration: 120 }));
        dropY.value = withDelay(
          delay,
          withSpring(0, { damping: 8, stiffness: 220, mass: 0.6 }),
        );
        dropScale.value = withDelay(
          delay,
          withSpring(1, { damping: 8, stiffness: 220, mass: 0.6 }),
        );
      } else {
        // Already-known marker — just show it
        dropOpacity.value = 1;
        dropY.value = 0;
        dropScale.value = 1;
      }
    }, [marker.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const mountStyle = useAnimatedStyle(() => ({
      opacity: dropOpacity.value,
      transform: [
        { translateY: dropY.value },
        { scale: dropScale.value },
      ],
    }));

    return (
      <Animated.View style={mountStyle}>
        <EmojiMapMarker
          event={marker}
          isSelected={isSelected}
          isHighlighted={false}
          onPress={handlePress}
          index={index}
          breathingScale={breathingScale}
        />
      </Animated.View>
    );
  },
);

const ClusterSlotContent = React.memo(
  ({
    cluster,
    isSelected,
    onPress,
    clusterPulse,
    isNew,
    newIndex,
    staggerDelay,
    seenHapticIds,
  }: {
    cluster: ClusterItem;
    isSelected: boolean;
    onPress: () => void;
    clusterPulse: SharedValue<number>;
    isNew: boolean;
    newIndex: number;
    staggerDelay: number;
    seenHapticIds: React.MutableRefObject<Set<string>>;
  }) => {
    // Haptic feedback — only for genuinely new clusters, not reclustering.
    const hasPlayedHaptic = useRef(false);
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (!isNew || hasPlayedHaptic.current) return;
      if (seenHapticIds.current.has(cluster.id)) return;
      if (seenHapticIds.current.size >= 3) return;
      hasPlayedHaptic.current = true;
      seenHapticIds.current.add(cluster.id);
      const hapticDelay = Math.min(newIndex, 5) * staggerDelay;
      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, hapticDelay);
      return () => clearTimeout(timer);
    }, [newIndex, cluster.id, seenHapticIds, isNew, staggerDelay]);

    // Entrance animation — only for genuinely new clusters.
    // Recluster transitions: instant show, no animation.
    const dropScale = useSharedValue(isNew ? 0.5 : 1);
    const dropOpacity = useSharedValue(isNew ? 0 : 1);
    const hasAnimated = useRef(false);

    useEffect(() => {
      if (hasAnimated.current) {
        // Slot reused — instant show
        dropScale.value = 1;
        dropOpacity.value = 1;
        return;
      }
      hasAnimated.current = true;

      if (isNew) {
        const delay = Math.min(newIndex, 5) * staggerDelay;
        dropOpacity.value = withDelay(delay, withTiming(1, { duration: 150 }));
        dropScale.value = withDelay(
          delay,
          withSpring(1, { damping: 12, stiffness: 200 }),
        );
      } else {
        dropOpacity.value = 1;
        dropScale.value = 1;
      }
    }, [cluster.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const mountStyle = useAnimatedStyle(() => ({
      opacity: dropOpacity.value,
      transform: [{ scale: dropScale.value }],
    }));

    return (
      <Animated.View style={mountStyle}>
        <ClusterMarker
          count={cluster.count}
          coordinates={cluster.coordinates}
          onPress={onPress}
          isSelected={isSelected}
          dominantCategory={cluster.dominantCategory}
          clusterPulse={clusterPulse}
        />
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// Pool slot — a single pre-mounted MarkerView that gets reused
// ---------------------------------------------------------------------------

interface PoolSlotData {
  coordinate: [number, number];
  anchor: { x: number; y: number };
  content:
    | { type: "marker"; props: React.ComponentProps<typeof MarkerSlotContent> }
    | { type: "cluster"; props: React.ComponentProps<typeof ClusterSlotContent> }
    | null;
}

const PoolSlot = React.memo(
  ({ data }: { data: PoolSlotData }) => {
    return (
      <MapboxGL.MarkerView
        coordinate={data.coordinate}
        anchor={data.anchor}
      >
        {data.content?.type === "marker" ? (
          <MarkerSlotContent {...data.content.props} />
        ) : data.content?.type === "cluster" ? (
          <ClusterSlotContent {...data.content.props} />
        ) : null}
      </MapboxGL.MarkerView>
    );
  },
  (prev, next) => {
    // Only re-render if the slot data actually changed
    if (prev.data.coordinate !== next.data.coordinate) return false;
    if (prev.data.content === null && next.data.content === null) return true;
    if (prev.data.content === null || next.data.content === null) return false;
    if (prev.data.content.type !== next.data.content.type) return false;
    // Shallow compare props object reference (reconstructed each render when data changes)
    return prev.data.content.props === next.data.content.props;
  },
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ClusteredMapMarkers: React.FC<ClusteredMapMarkersProps> =
  React.memo(({ currentZoom = 14, viewport }) => {
    // Zoom tier: high (14+) = full animations, mid (10-13) = subtle, low (<10) = static
    const isHighZoom = currentZoom >= 14;
    const isMidZoom = currentZoom >= 10 && currentZoom < 14;

    // Breathing animation — only at high zoom for that alive, Pokemon Go feel
    const breathingScale = useSharedValue(1);
    useEffect(() => {
      if (isHighZoom) {
        breathingScale.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 1500 }),
            withTiming(0.98, { duration: 1500 }),
          ),
          -1,
          true,
        );
      } else {
        cancelAnimation(breathingScale);
        breathingScale.value = withTiming(1, { duration: 200 });
      }
      return () => cancelAnimation(breathingScale);
    }, [isHighZoom]);

    // Cluster pulse — high zoom only
    const clusterPulse = useSharedValue(1);
    useEffect(() => {
      if (isHighZoom) {
        clusterPulse.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1500 }),
            withTiming(1, { duration: 1500 }),
          ),
          -1,
          true,
        );
      } else {
        cancelAnimation(clusterPulse);
        clusterPulse.value = withTiming(1, { duration: 200 });
      }
      return () => cancelAnimation(clusterPulse);
    }, [isHighZoom]);

    // Get marker data from store
    const markers = useLocationStore((state) => state.markers);
    const selectedItem = useLocationStore((state) => state.selectedItem);
    const selectMapItem = useLocationStore((state) => state.selectMapItem);
    const router = useRouter();

    // Track which marker/cluster IDs have already triggered haptics
    const seenHapticIds = useRef(new Set<string>());
    const prevMarkersRef = useRef(markers);

    useEffect(() => {
      if (markers !== prevMarkersRef.current) {
        prevMarkersRef.current = markers;
        seenHapticIds.current.clear();
      }
    }, [markers]);

    // Persistent set of all marker IDs ever rendered (for haptic gating)
    const knownMarkerIds = useRef(new Set<string>());

    useEffect(() => {
      for (const m of markers) {
        knownMarkerIds.current.add(m.id);
      }
    }, [markers]);

    // Category lookup for cluster coloring
    const categoryLookup = useMemo(() => {
      const lookup = new Map<string, string>();
      for (const m of markers) {
        const cat = m.data.categories?.[0];
        if (cat) lookup.set(m.id, cat);
      }
      return lookup;
    }, [markers]);

    // Clustering
    const { clusters } = useMarkerClustering(markers, viewport, currentZoom);

    // Handlers
    const createClusterPressHandler = useCallback(
      (coordinates: [number, number], childrenIds: string[]) => {
        return () => {
          const ids = childrenIds.join(",");
          router.push(
            `cluster?lat=${coordinates[1]}&lng=${coordinates[0]}&zoom=${currentZoom}&childrenIds=${ids}` as never,
          );
        };
      },
      [currentZoom, router],
    );

    const createMarkerSelectHandler = useCallback(
      (item: MarkerItem) => {
        return () => {
          selectMapItem(item);
          eventBroker.emit<CameraAnimateToLocationEvent>(
            EventTypes.CAMERA_ANIMATE_TO_LOCATION,
            {
              coordinates: item.coordinates,
              duration: 500,
              animationMode: "easeTo",
              zoomLevel: 16,
              allowZoomChange: true,
              source: "MarkerSelection",
              timestamp: Date.now(),
            },
          );
        };
      },
      [selectMapItem],
    );

    const createMarkerNavigateHandler = useCallback(
      (id: string) => {
        return () => {
          router.push(`details?eventId=${id}` as never);
        };
      },
      [router],
    );

    const selectedId = selectedItem?.id ?? null;

    // Process clusters into renderable items
    const processCluster = useCallback(
      (feature: ClusterFeature | PointFeature) => {
        if (feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature;
          const coordinates = clusterFeature.geometry.coordinates as [number, number];
          const count = clusterFeature.properties.point_count;
          const clusterId =
            clusterFeature.properties.stableId ||
            `cluster-${clusterFeature.properties.cluster_id}`;
          const childMarkerIds = clusterFeature.properties.childMarkers || [];
          const isNew = childMarkerIds.some(
            (id) => !knownMarkerIds.current.has(id),
          );
          const dominantCategory = getDominantCategory(childMarkerIds, categoryLookup);

          return {
            type: "cluster" as const,
            item: {
              id: clusterId,
              type: "cluster" as const,
              coordinates,
              count,
              childrenIds: childMarkerIds,
              dominantCategory: dominantCategory ?? undefined,
            },
            isSelected: false,
            onPress: createClusterPressHandler(coordinates, childMarkerIds),
            isNew,
          };
        } else {
          const pointFeature = feature as PointFeature;
          const markerId = pointFeature.properties.id;
          const coordinates = pointFeature.geometry.coordinates as [number, number];
          const data = pointFeature.properties.data;
          const markerItem: MarkerItem = {
            id: markerId,
            type: "marker" as const,
            coordinates,
            data,
          };
          const isNew = !knownMarkerIds.current.has(markerId);

          return {
            type: "marker" as const,
            item: markerItem,
            isSelected: markerId === selectedId,
            onSelect: createMarkerSelectHandler(markerItem),
            onNavigate: createMarkerNavigateHandler(markerId),
            isNew,
          };
        }
      },
      [
        createClusterPressHandler,
        createMarkerSelectHandler,
        createMarkerNavigateHandler,
        selectedId,
        categoryLookup,
      ],
    );

    const processedClusters = useMemo(() => {
      return clusters.map((feature, index) => ({
        ...processCluster(feature),
        index,
      }));
    }, [clusters, processCluster]);

    // Viewport culling with 15% buffer
    const visibleItems = useMemo(() => {
      const lngSpan = viewport.east - viewport.west;
      const latSpan = viewport.north - viewport.south;
      const lngBuffer = lngSpan * 0.15;
      const latBuffer = latSpan * 0.15;
      return processedClusters.filter((item) => {
        if (item.type === "marker" && item.isSelected) return true;
        const [lng, lat] = item.item.coordinates;
        return (
          lng >= viewport.west - lngBuffer &&
          lng <= viewport.east + lngBuffer &&
          lat >= viewport.south - latBuffer &&
          lat <= viewport.north + latBuffer
        );
      });
    }, [processedClusters, viewport]);

    // Tag items with stagger indices for entrance animations + haptics.
    // High zoom: full pin-drop animations with stagger (magical, responsive)
    // Mid zoom: entrance animations with tighter budget (mildly dynamic)
    // Low zoom: no entrance animations (static, just data updates)
    const itemsWithNewIndex = useMemo(() => {
      // Low zoom — completely static, no entrance animations
      if (!isHighZoom && !isMidZoom) {
        return visibleItems.map((item, index) => ({
          ...item,
          index,
          newIndex: 0,
          isNew: false,
          staggerDelay: 0,
        }));
      }

      let newCounter = 0;
      const tagged = visibleItems.map((item, index) => ({
        ...item,
        index,
        newIndex: item.isNew ? newCounter++ : 0,
      }));
      const newCount = newCounter;
      // High zoom: generous budget for that magical feel; mid zoom: tighter
      const budget = isHighZoom ? ANIMATION_BUDGET : 8;
      const shouldAnimate = newCount <= budget;
      const maxSlots = Math.min(newCount, 5);
      const staggerDelay =
        maxSlots > 0 ? Math.min(80, Math.floor(300 / maxSlots)) : 0;
      return tagged.map((item) => ({
        ...item,
        isNew: shouldAnimate && item.isNew,
        staggerDelay,
      }));
    }, [visibleItems, isHighZoom, isMidZoom]);

    // Sync visible marker stats to store for MapLegend.
    // Uses a ref to skip store writes when counts haven't changed,
    // avoiding unnecessary MapLegend re-renders during panning.
    const setVisibleMarkerStats = useLocationStore(
      (state) => state.setVisibleMarkerStats,
    );
    const prevStatsRef = useRef<{ counts: Record<string, number>; total: number }>({
      counts: {},
      total: 0,
    });
    useEffect(() => {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const item of itemsWithNewIndex) {
        if (item.type === "marker") {
          total += 1;
          const cat = item.item.data.categories?.[0];
          if (cat) counts[cat] = (counts[cat] || 0) + 1;
        } else {
          total += item.item.count;
          for (const childId of item.item.childrenIds) {
            const cat = categoryLookup.get(childId);
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
          }
        }
      }

      // Skip store write if nothing changed
      const prev = prevStatsRef.current;
      if (prev.total === total) {
        const keys = Object.keys(counts);
        const prevKeys = Object.keys(prev.counts);
        if (
          keys.length === prevKeys.length &&
          keys.every((k) => counts[k] === prev.counts[k])
        ) {
          return;
        }
      }
      prevStatsRef.current = { counts, total };
      setVisibleMarkerStats(counts, total);
    }, [itemsWithNewIndex, categoryLookup, setVisibleMarkerStats]);

    // Use items directly — the debounced viewport in useMapViewport already
    // throttles how often clustering input changes. Freezing during camera
    // movement caused a batch-update stutter when the camera settled.
    const stableItems = itemsWithNewIndex;

    // Dynamic pool size — at low zoom most items are clusters so we need fewer
    // React-managed MarkerView slots, reducing reconciliation cost.
    const effectivePoolSize = useMemo(() => {
      if (currentZoom >= 14) return MAX_POOL_SIZE;
      if (currentZoom >= 10) return 30;
      return 15;
    }, [currentZoom]);

    // -----------------------------------------------------------------------
    // Build pool slot data — map each visible item to a slot, rest go offscreen
    // -----------------------------------------------------------------------
    const poolData = useMemo(() => {
      const slots: PoolSlotData[] = [];
      const count = Math.min(stableItems.length, effectivePoolSize);

      for (let i = 0; i < count; i++) {
        const processed = stableItems[i];
        if (processed.type === "cluster") {
          slots.push({
            coordinate: processed.item.coordinates,
            anchor: { x: 0.5, y: 0.5 },
            content: {
              type: "cluster",
              props: {
                cluster: processed.item,
                isSelected: processed.isSelected,
                onPress: processed.onPress,
                clusterPulse,
                isNew: processed.isNew,
                newIndex: processed.newIndex,
                staggerDelay: processed.staggerDelay,
                seenHapticIds,
              },
            },
          });
        } else {
          slots.push({
            coordinate: processed.item.coordinates,
            anchor: { x: 0.5, y: 1.0 },
            content: {
              type: "marker",
              props: {
                marker: processed.item,
                isSelected: processed.isSelected,
                onSelect: processed.onSelect,
                onNavigate: processed.onNavigate,
                index: processed.index,
                breathingScale,
                isNew: processed.isNew,
                newIndex: processed.newIndex,
                staggerDelay: processed.staggerDelay,
                seenHapticIds,
              },
            },
          });
        }
      }

      // Fill remaining pool slots with offscreen empty markers
      for (let i = count; i < effectivePoolSize; i++) {
        slots.push({
          coordinate: OFFSCREEN,
          anchor: { x: 0.5, y: 0.5 },
          content: null,
        });
      }

      return slots;
    }, [stableItems, breathingScale, clusterPulse, effectivePoolSize]);

    return (
      <>
        {poolData.map((slot, i) => (
          <PoolSlot key={`pool-${i}`} data={slot} />
        ))}
      </>
    );
  });
