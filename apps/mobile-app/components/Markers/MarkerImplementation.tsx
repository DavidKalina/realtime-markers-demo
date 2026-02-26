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

const SingleMarkerView = React.memo(
  ({
    marker,
    isSelected,
    onPress,
    index,
  }: {
    marker: MarkerItem;
    isSelected: boolean;
    onPress: () => void;
    index: number;
  }) => {
    // Add haptic feedback for each marker's appearance
    useEffect(() => {
      if (Platform.OS === "web") return;

      // Delay haptic to match the staggered animation
      const hapticDelay = Math.min(index, 5) * 80; // Match the capped stagger

      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, hapticDelay);

      return () => clearTimeout(timer);
    }, [index]);

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
            onPress={onPress}
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
  }: {
    cluster: ClusterItem;
    isSelected: boolean;
    onPress: () => void;
    index: number;
  }) => {
    // Add haptic feedback for each cluster's appearance
    useEffect(() => {
      if (Platform.OS === "web") return;

      // Delay haptic to match the staggered animation
      const hapticDelay = Math.min(index, 5) * 50; // Match the capped stagger

      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, hapticDelay);

      return () => clearTimeout(timer);
    }, [index]);

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
      prevProps.index === nextProps.index
    );
  },
);

export const ClusteredMapMarkers: React.FC<ClusteredMapMarkersProps> =
  React.memo(({ currentZoom = 14, viewport }) => {
    // Get marker data from store
    const markers = useLocationStore((state) => state.markers);
    const router = useRouter();

    // Get clusters based on current markers, viewport, and zoom level
    const { clusters } = useMarkerClustering(markers, viewport, currentZoom);

    // Single tap → navigate directly
    const createPressHandler = useCallback(
      (type: "marker" | "cluster", id: string, coordinates: [number, number]) => {
        return () => {
          if (type === "marker") {
            router.push(`details?eventId=${id}` as never);
          } else {
            router.push(
              `cluster?lat=${coordinates[1]}&lng=${coordinates[0]}&zoom=${currentZoom}` as never,
            );
          }
        };
      },
      [currentZoom, router],
    );

    // Memoize the cluster processing function with stable references
    const processCluster = useCallback(
      (feature: ClusterFeature | PointFeature) => {
        if (feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature;
          const coordinates = clusterFeature.geometry.coordinates as [number, number];
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
            onPress: createPressHandler("cluster", clusterId, coordinates),
          };
        } else {
          const pointFeature = feature as PointFeature;
          const markerId = pointFeature.properties.id;
          const coordinates = pointFeature.geometry.coordinates as [number, number];
          const data = pointFeature.properties.data;

          return {
            type: "marker" as const,
            item: {
              id: markerId,
              type: "marker" as const,
              coordinates,
              data,
            },
            isSelected: false,
            onPress: createPressHandler("marker", markerId, coordinates),
          };
        }
      },
      [createPressHandler],
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
        />
      ),
      [],
    );

    const renderMarker = useCallback(
      (processed: {
        type: "marker";
        item: MarkerItem;
        isSelected: boolean;
        onPress: () => void;
        index: number;
      }) => (
        <SingleMarkerView
          key={processed.item.id}
          marker={processed.item}
          isSelected={processed.isSelected}
          onPress={processed.onPress}
          index={processed.index}
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
