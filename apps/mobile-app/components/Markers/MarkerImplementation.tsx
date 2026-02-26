// components/Markers/ClusteredMapMarkers.tsx
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  ClusterFeature,
  PointFeature,
  useMarkerClustering,
} from "@/hooks/useMarkerClustering";
import {
  CameraAnimateToLocationEvent,
  ClusterItem as EventClusterItem,
  MarkerItem as EventMarkerItem,
  EventTypes,
  MapItemEvent,
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { Marker, MapboxViewport } from "@/types/types";
import type { MapItem, MarkerItem, ClusterItem } from "@/types/map";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useMemo, useEffect } from "react";
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
      const hapticDelay = index * 300; // Match the animation delay

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
            .delay(index * 300)}
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
      const hapticDelay = index * 50; // Match the animation delay

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
            .delay(index * 50)}
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
    const selectMapItem = useLocationStore((state) => state.selectMapItem);
    const isItemSelected = useLocationStore((state) => state.isItemSelected);
    const router = useRouter();
    const { publish } = useEventBroker();

    // Get clusters based on current markers, viewport, and zoom level
    const { clusters } = useMarkerClustering(markers, viewport, currentZoom);

    // Read selectedItem imperatively from the store inside the handler
    // so the callback identity stays stable across selection changes.
    const createMapItemPressHandler = useCallback(
      (item: MapItem) => {
        return () => {
          const currentSelected = useLocationStore.getState().selectedItem;

          // SECOND TAP: already selected → navigate to details
          if (currentSelected?.id === item.id) {
            if (item.type === "marker") {
              router.push(`details?eventId=${item.id}` as never);
            } else {
              // Navigate to cluster view with coordinates
              router.push(
                `cluster?lat=${item.coordinates[1]}&lng=${item.coordinates[0]}&zoom=${currentZoom}` as never,
              );
            }
            return;
          }

          // FIRST TAP: select + animate camera, no navigation
          selectMapItem(item);

          if (item.type === "marker") {
            const markerEventItem: EventMarkerItem = {
              id: item.id,
              type: "marker",
              coordinates: item.coordinates,
              markerData: item.data,
            };

            publish<MapItemEvent>(EventTypes.MAP_ITEM_SELECTED, {
              timestamp: Date.now(),
              source: "ClusteredMapMarkers",
              item: markerEventItem,
            });

            publish(EventTypes.MARKER_SELECTED, {
              timestamp: Date.now(),
              source: "ClusteredMapMarkers",
              markerId: item.id,
              markerData: item.data,
            });

            publish<CameraAnimateToLocationEvent>(
              EventTypes.CAMERA_ANIMATE_TO_LOCATION,
              {
                timestamp: Date.now(),
                source: "ClusteredMapMarkers",
                coordinates: item.coordinates,
                duration: 400,
                zoomLevel: 16,
                allowZoomChange: true,
              },
            );
          } else {
            const clusterEventItem: EventClusterItem = {
              id: item.id,
              type: "cluster",
              coordinates: item.coordinates,
              count: item.count,
              childMarkers: item.childrenIds,
            };

            publish<MapItemEvent>(EventTypes.MAP_ITEM_SELECTED, {
              timestamp: Date.now(),
              source: "ClusteredMapMarkers",
              item: clusterEventItem,
            });

            publish(EventTypes.CLUSTER_SELECTED, {
              timestamp: Date.now(),
              source: "ClusteredMapMarkers",
              clusterId: item.id,
              clusterInfo: {
                count: item.count,
                coordinates: item.coordinates,
                childMarkers: item.childrenIds,
              },
            });

            publish<CameraAnimateToLocationEvent>(
              EventTypes.CAMERA_ANIMATE_TO_LOCATION,
              {
                timestamp: Date.now(),
                source: "ClusteredMapMarkers",
                coordinates: item.coordinates,
                duration: 400,
                zoomLevel: currentZoom,
                allowZoomChange: false,
              },
            );
          }
        };
      },
      [currentZoom, publish, selectMapItem, router],
    );

    // Memoize the cluster processing function with stable references
    const processCluster = useCallback(
      (feature: ClusterFeature | PointFeature) => {
        if (feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature;
          const coordinates = clusterFeature.geometry.coordinates;
          const count = clusterFeature.properties.point_count;
          const clusterId =
            clusterFeature.properties.stableId ||
            `cluster-${clusterFeature.properties.cluster_id}`;

          return {
            type: "cluster" as const,
            item: {
              id: clusterId,
              type: "cluster" as const,
              coordinates: coordinates as [number, number],
              count,
              childrenIds: clusterFeature.properties.childMarkers || [], // Ensure we always have an array
            },
            isSelected: isItemSelected(clusterId),
            onPress: createMapItemPressHandler({
              id: clusterId,
              type: "cluster" as const,
              coordinates: coordinates as [number, number],
              count,
              childrenIds: clusterFeature.properties.childMarkers || [], // Ensure we always have an array
            }),
          };
        } else {
          const pointFeature = feature as PointFeature;
          const markerId = pointFeature.properties.id;
          const coordinates = pointFeature.geometry.coordinates;
          const data = pointFeature.properties.data;

          return {
            type: "marker" as const,
            item: {
              id: markerId,
              type: "marker" as const,
              coordinates: coordinates as [number, number],
              data,
            },
            isSelected: isItemSelected(markerId),
            onPress: createMapItemPressHandler({
              id: markerId,
              type: "marker" as const,
              coordinates: coordinates as [number, number],
              data,
            }),
          };
        }
      },
      [createMapItemPressHandler, isItemSelected],
    );

    // Process and memoize clusters for rendering with stable references
    const processedClusters = useMemo(() => {
      return clusters.map((feature, index) => ({
        ...processCluster(feature),
        index,
      }));
    }, [clusters, processCluster]);

    // Further optimize by adding culling for markers that are outside the viewport
    // This is a simple implementation - you may want to add a buffer zone
    const visibleItems = useMemo(() => {
      return processedClusters.filter((item) => {
        const [lng, lat] = item.item.coordinates;
        return (
          lng >= viewport.west &&
          lng <= viewport.east &&
          lat >= viewport.south &&
          lat <= viewport.north
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
