// components/Markers/ClusteredMapMarkers.tsx
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
import Animated, { BounceIn, FadeOut } from "react-native-reanimated";
import { ClusterMarker } from "./ClusterMarker";
import { EmojiMapMarker } from "./CustomMapMarker";
import { spring } from "@/theme";
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
  isCameraMoving?: boolean;
}

const DOUBLE_TAP_WINDOW = 300;

const SingleMarkerView = React.memo(
  ({
    marker,
    isSelected,
    onSelect,
    onNavigate,
    index,
    newIndex,
    seenHapticIds,
    isNew,
  }: {
    marker: MarkerItem;
    isSelected: boolean;
    onSelect: () => void;
    onNavigate: () => void;
    index: number;
    newIndex: number;
    seenHapticIds: React.MutableRefObject<Set<string>>;
    isNew: boolean;
  }) => {
    const lastTapRef = useRef(0);

    // Single tap → select (show HUD), double tap → navigate to details
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

    // Add haptic feedback for each marker's first appearance only.
    // Cap at 3 haptic fires per batch to prevent storms in dense areas.
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (!isNew) return;
      if (seenHapticIds.current.has(marker.id)) return;
      if (seenHapticIds.current.size >= 3) return;
      seenHapticIds.current.add(marker.id);

      // Delay haptic to match the staggered animation
      const hapticDelay = Math.min(newIndex, 5) * 80;

      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, hapticDelay);

      return () => clearTimeout(timer);
    }, [newIndex, marker.id, seenHapticIds, isNew]);

    const entering = BounceIn.springify()
      .damping(spring.firm.damping)
      .stiffness(spring.firm.stiffness)
      .delay(Math.min(newIndex, 5) * 80);
    return (
      <MapboxGL.MarkerView
        key={`marker-${marker.id}`}
        coordinate={marker.coordinates}
        anchor={{ x: 0.5, y: 1.0 }}
      >
        <Animated.View entering={entering} exiting={FadeOut.duration(100)}>
          <EmojiMapMarker
            event={marker}
            isSelected={isSelected}
            isHighlighted={false}
            onPress={handlePress}
            index={index}
          />
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
);

// Component for rendering a cluster - memoized with proper prop comparison
const ClusterView = React.memo(
  ({
    cluster,
    isSelected,
    onPress,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    index,
    newIndex,
    seenHapticIds,
    isNew,
  }: {
    cluster: ClusterItem;
    isSelected: boolean;
    onPress: () => void;
    index: number;
    newIndex: number;
    seenHapticIds: React.MutableRefObject<Set<string>>;
    isNew: boolean;
  }) => {
    // Add haptic feedback for each cluster's first appearance only.
    // Cap at 3 haptic fires per batch to prevent storms in dense areas.
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (!isNew) return;
      if (seenHapticIds.current.has(cluster.id)) return;
      if (seenHapticIds.current.size >= 3) return;
      seenHapticIds.current.add(cluster.id);

      // Delay haptic to match the staggered animation
      const hapticDelay = Math.min(newIndex, 5) * 50;

      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, hapticDelay);

      return () => clearTimeout(timer);
    }, [newIndex, cluster.id, seenHapticIds, isNew]);

    // Always bounce clusters in — a cluster appearing (whether from new markers
    // or reclustering) is a meaningful visual event worth animating.
    const entering = BounceIn.springify()
      .damping(spring.firm.damping)
      .stiffness(spring.firm.stiffness)
      .delay(isNew ? Math.min(newIndex, 5) * 50 : 0);

    return (
      <MapboxGL.MarkerView
        key={cluster.id}
        coordinate={cluster.coordinates}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <Animated.View entering={entering} exiting={FadeOut.duration(100)}>
          <ClusterMarker
            count={cluster.count}
            coordinates={cluster.coordinates}
            onPress={onPress}
            isSelected={isSelected}
            dominantCategory={cluster.dominantCategory}
          />
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.cluster.id === nextProps.cluster.id &&
      prevProps.cluster.count === nextProps.cluster.count &&
      prevProps.cluster.coordinates[0] === nextProps.cluster.coordinates[0] &&
      prevProps.cluster.coordinates[1] === nextProps.cluster.coordinates[1] &&
      prevProps.cluster.dominantCategory ===
        nextProps.cluster.dominantCategory &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.index === nextProps.index &&
      prevProps.newIndex === nextProps.newIndex &&
      prevProps.seenHapticIds === nextProps.seenHapticIds &&
      prevProps.isNew === nextProps.isNew
    );
  },
);

export const ClusteredMapMarkers: React.FC<ClusteredMapMarkersProps> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  React.memo(({ currentZoom = 14, viewport, isCameraMoving = false }) => {
    // Get marker data from store
    const markers = useLocationStore((state) => state.markers);
    const selectedItem = useLocationStore((state) => state.selectedItem);
    const selectMapItem = useLocationStore((state) => state.selectMapItem);
    const router = useRouter();

    // Track which marker/cluster IDs have already triggered haptics to avoid
    // re-firing during re-clustering caused by panning/zooming.
    const seenHapticIds = useRef(new Set<string>());
    const prevMarkersRef = useRef(markers);

    // Clear seen IDs when the markers array reference changes (full replace
    // from the server), so new batches of markers get haptic feedback.
    useEffect(() => {
      if (markers !== prevMarkersRef.current) {
        prevMarkersRef.current = markers;
        seenHapticIds.current.clear();
      }
    }, [markers]);

    // Persistent set of all marker IDs that have ever been rendered on screen.
    // Used to distinguish genuinely new markers (→ BounceIn) from reclustering
    // remounts (→ no animation). Never cleared — IDs accumulate over the
    // session so returning to a previously visited area won't re-bounce.
    const knownMarkerIds = useRef(new Set<string>());

    // Populate after each render so the NEXT reclustering sees them as known.
    useEffect(() => {
      for (const m of markers) {
        knownMarkerIds.current.add(m.id);
      }
    }, [markers]);

    // Build a lookup map from marker ID → primary category for cluster coloring
    const categoryLookup = useMemo(() => {
      const lookup = new Map<string, string>();
      for (const m of markers) {
        const cat = m.data.categories?.[0];
        if (cat) lookup.set(m.id, cat);
      }
      return lookup;
    }, [markers]);

    // At zoom 13+ marker density is low enough that mid-gesture reclustering
    // no longer causes split/merge jank, so we use live values directly and
    // let markers stream in while the camera is still moving.
    const clusterViewport = viewport;
    const clusterMarkers = markers;
    const clusterZoom = currentZoom;

    // Get clusters based on current (or frozen) markers, viewport, and zoom level
    const { clusters } = useMarkerClustering(
      clusterMarkers,
      clusterViewport,
      clusterZoom,
    );

    // Cluster: single tap → navigate
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

    // Marker: single tap → select (show HUD) + pan camera
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
              source: "MarkerSelection",
              timestamp: Date.now(),
            },
          );
        };
      },
      [selectMapItem],
    );

    // Marker: double tap → navigate to details
    const createMarkerNavigateHandler = useCallback(
      (id: string) => {
        return () => {
          router.push(`details?eventId=${id}` as never);
        };
      },
      [router],
    );

    const selectedId = selectedItem?.id ?? null;

    // Memoize the cluster processing function with stable references
    const processCluster = useCallback(
      (feature: ClusterFeature | PointFeature) => {
        if (feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature;
          const coordinates = clusterFeature.geometry.coordinates as [
            number,
            number,
          ];
          const count = clusterFeature.properties.point_count;
          const clusterId =
            clusterFeature.properties.stableId ||
            `cluster-${clusterFeature.properties.cluster_id}`;
          const childMarkerIds = clusterFeature.properties.childMarkers || [];

          // Cluster is "new" only if it contains marker IDs we haven't seen
          const isNew = childMarkerIds.some(
            (id) => !knownMarkerIds.current.has(id),
          );

          const dominantCategory = getDominantCategory(
            childMarkerIds,
            categoryLookup,
          );

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
          const coordinates = pointFeature.geometry.coordinates as [
            number,
            number,
          ];
          const data = pointFeature.properties.data;
          const markerItem: MarkerItem = {
            id: markerId,
            type: "marker" as const,
            coordinates,
            data,
          };

          // Marker is "new" only if this ID hasn't been on screen before
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

    // Process and memoize clusters for rendering with stable references
    const processedClusters = useMemo(() => {
      return clusters.map((feature, index) => ({
        ...processCluster(feature),
        index,
      }));
    }, [clusters, processCluster]);

    // Cull markers outside the viewport, with a 15% buffer to prevent
    // edge-popping during pan/zoom gestures
    const visibleItems = useMemo(() => {
      const lngSpan = viewport.east - viewport.west;
      const latSpan = viewport.north - viewport.south;
      const lngBuffer = lngSpan * 0.15;
      const latBuffer = latSpan * 0.15;
      return processedClusters.filter((item) => {
        const [lng, lat] = item.item.coordinates;
        return (
          lng >= viewport.west - lngBuffer &&
          lng <= viewport.east + lngBuffer &&
          lat >= viewport.south - latBuffer &&
          lat <= viewport.north + latBuffer
        );
      });
    }, [processedClusters, viewport]);

    // Compute a stable newIndex for each item: position among genuinely new
    // items only. Returning/reclustered markers get newIndex 0 (unused since
    // isNew is false), while new ones get sequential indices for stagger.
    const itemsWithNewIndex = useMemo(() => {
      let newCounter = 0;
      return visibleItems.map((item, index) => ({
        ...item,
        index,
        newIndex: item.isNew ? newCounter++ : 0,
      }));
    }, [visibleItems]);

    // Memoize the render functions to prevent recreation
    const renderCluster = useCallback(
      (processed: {
        type: "cluster";
        item: ClusterItem;
        isSelected: boolean;
        onPress: () => void;
        index: number;
        newIndex: number;
        isNew: boolean;
      }) => (
        <ClusterView
          key={processed.item.id}
          cluster={processed.item}
          isSelected={processed.isSelected}
          onPress={processed.onPress}
          index={processed.index}
          newIndex={processed.newIndex}
          seenHapticIds={seenHapticIds}
          isNew={processed.isNew}
        />
      ),
      [],
    );

    const renderMarker = useCallback(
      (processed: {
        type: "marker";
        item: MarkerItem;
        isSelected: boolean;
        onSelect: () => void;
        onNavigate: () => void;
        index: number;
        newIndex: number;
        isNew: boolean;
      }) => (
        <SingleMarkerView
          key={processed.item.id}
          marker={processed.item}
          isSelected={processed.isSelected}
          onSelect={processed.onSelect}
          onNavigate={processed.onNavigate}
          index={processed.index}
          newIndex={processed.newIndex}
          seenHapticIds={seenHapticIds}
          isNew={processed.isNew}
        />
      ),
      [],
    );

    return (
      <>
        {itemsWithNewIndex.map((processed) => {
          if (processed.type === "cluster") {
            return renderCluster(processed);
          } else {
            return renderMarker(processed);
          }
        })}
      </>
    );
  });
