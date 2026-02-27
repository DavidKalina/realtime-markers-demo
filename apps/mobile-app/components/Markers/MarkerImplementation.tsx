// components/Markers/ClusteredMapMarkers.tsx
import {
  ClusterFeature,
  PointFeature,
  useMarkerClustering,
} from "@/hooks/useMarkerClustering";
import { useLocationStore } from "@/stores/useLocationStore";
import { Marker, MapboxViewport } from "@/types/types";
import type { MarkerItem, ClusterItem } from "@/types/map";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useMemo, useEffect, useRef } from "react";
import Animated, {
  BounceIn,
  BounceOut,
  LinearTransition,
} from "react-native-reanimated";
import { ClusterMarker } from "./ClusterMarker";
import { EmojiMapMarker } from "./CustomMapMarker";
import { spring } from "@/theme";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

interface ClusteredMapMarkersProps {
  markers?: Marker[];
  currentZoom?: number;
  viewport: MapboxViewport;
}

const DOUBLE_TAP_WINDOW = 300;

const SingleMarkerView = React.memo(
  ({
    marker,
    isSelected,
    onSelect,
    onNavigate,
    index,
    seenHapticIds,
  }: {
    marker: MarkerItem;
    isSelected: boolean;
    onSelect: () => void;
    onNavigate: () => void;
    index: number;
    seenHapticIds: React.MutableRefObject<Set<string>>;
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

    // Add haptic feedback for each marker's first appearance only
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (seenHapticIds.current.has(marker.id)) return;
      seenHapticIds.current.add(marker.id);

      // Delay haptic to match the staggered animation
      const hapticDelay = Math.min(index, 5) * 80; // Match the capped stagger

      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, hapticDelay);

      return () => clearTimeout(timer);
    }, [index, marker.id, seenHapticIds]);

    return (
      <MapboxGL.MarkerView
        key={`marker-${marker.id}`}
        coordinate={marker.coordinates}
        anchor={{ x: 0.5, y: 1.0 }}
      >
        <Animated.View
          entering={BounceIn.duration(500)
            .springify()
            .damping(spring.firm.damping)
            .stiffness(spring.firm.stiffness)
            .delay(Math.min(index, 5) * 80)}
          exiting={BounceOut.duration(500)
            .springify()
            .damping(spring.firm.damping)
            .stiffness(spring.firm.stiffness)}
          layout={LinearTransition.springify()}
        >
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
    index,
    seenHapticIds,
  }: {
    cluster: ClusterItem;
    isSelected: boolean;
    onPress: () => void;
    index: number;
    seenHapticIds: React.MutableRefObject<Set<string>>;
  }) => {
    // Add haptic feedback for each cluster's first appearance only
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (seenHapticIds.current.has(cluster.id)) return;
      seenHapticIds.current.add(cluster.id);

      // Delay haptic to match the staggered animation
      const hapticDelay = Math.min(index, 5) * 50; // Match the capped stagger

      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, hapticDelay);

      return () => clearTimeout(timer);
    }, [index, cluster.id, seenHapticIds]);

    return (
      <MapboxGL.MarkerView
        key={cluster.id}
        coordinate={cluster.coordinates}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <Animated.View
          entering={BounceIn.duration(500)
            .springify()
            .damping(spring.firm.damping)
            .stiffness(spring.firm.stiffness)
            .delay(Math.min(index, 5) * 50)}
          exiting={BounceOut.duration(500)
            .springify()
            .damping(spring.firm.damping)
            .stiffness(spring.firm.stiffness)}
          layout={LinearTransition.springify()}
        >
          <ClusterMarker
            count={cluster.count}
            coordinates={cluster.coordinates}
            onPress={onPress}
            isSelected={isSelected}
          />
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.cluster.id === nextProps.cluster.id &&
      prevProps.cluster.count === nextProps.cluster.count &&
      prevProps.cluster.coordinates[0] === nextProps.cluster.coordinates[0] &&
      prevProps.cluster.coordinates[1] === nextProps.cluster.coordinates[1] &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.index === nextProps.index &&
      prevProps.seenHapticIds === nextProps.seenHapticIds
    );
  },
);

export const ClusteredMapMarkers: React.FC<ClusteredMapMarkersProps> =
  React.memo(({ currentZoom = 14, viewport }) => {
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

    // Get clusters based on current markers, viewport, and zoom level
    const { clusters } = useMarkerClustering(markers, viewport, currentZoom);

    // Cluster: single tap → navigate
    const createClusterPressHandler = useCallback(
      (coordinates: [number, number]) => {
        return () => {
          router.push(
            `cluster?lat=${coordinates[1]}&lng=${coordinates[0]}&zoom=${currentZoom}` as never,
          );
        };
      },
      [currentZoom, router],
    );

    // Marker: single tap → select (show HUD)
    const createMarkerSelectHandler = useCallback(
      (item: MarkerItem) => {
        return () => {
          selectMapItem(item);
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

          return {
            type: "cluster" as const,
            item: {
              id: clusterId,
              type: "cluster" as const,
              coordinates,
              count,
              childrenIds: clusterFeature.properties.childMarkers || [],
            },
            isSelected: false,
            onPress: createClusterPressHandler(coordinates),
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

          return {
            type: "marker" as const,
            item: markerItem,
            isSelected: markerId === selectedId,
            onSelect: createMarkerSelectHandler(markerItem),
            onNavigate: createMarkerNavigateHandler(markerId),
          };
        }
      },
      [
        createClusterPressHandler,
        createMarkerSelectHandler,
        createMarkerNavigateHandler,
        selectedId,
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

    // Memoize the render functions to prevent recreation
    const renderCluster = useCallback(
      (processed: {
        type: "cluster";
        item: ClusterItem;
        isSelected: boolean;
        onPress: () => void;
        index: number;
      }) => (
        <ClusterView
          key={processed.item.id}
          cluster={processed.item}
          isSelected={processed.isSelected}
          onPress={processed.onPress}
          index={processed.index}
          seenHapticIds={seenHapticIds}
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
      }) => (
        <SingleMarkerView
          key={processed.item.id}
          marker={processed.item}
          isSelected={processed.isSelected}
          onSelect={processed.onSelect}
          onNavigate={processed.onNavigate}
          index={processed.index}
          seenHapticIds={seenHapticIds}
        />
      ),
      [],
    );

    return (
      <>
        {visibleItems.map((processed, index) => {
          if (processed.type === "cluster") {
            return renderCluster({ ...processed, index });
          } else {
            return renderMarker({ ...processed, index });
          }
        })}
      </>
    );
  });
