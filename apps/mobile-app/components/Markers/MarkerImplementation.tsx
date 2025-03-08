// components/Markers/ClusteredMapMarkers.tsx
import React from "react";
import MapboxGL from "@rnmapbox/maps";
import { useLocationStore } from "@/stores/useLocationStore";
import { MysteryEmojiMarker } from "./CustomMapMarker";
import { ClusterMarker } from "./ClusterMarker";
import { useMarkerClustering, ClusterFeature, PointFeature } from "@/hooks/useMarkerClustering";
import { Marker } from "@/hooks/useMapWebsocket";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  EventTypes,
  CameraAnimateToLocationEvent,
  MapItemEvent,
  MarkerItem as EventMarkerItem,
  ClusterItem as EventClusterItem,
} from "@/services/EventBroker";
import { MapboxViewport } from "@/types/types";

// Define the map item types from the store (ideally these would be imported from a types file)
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

interface MarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

type MapItem = MarkerItem | ClusterItem;

interface ClusteredMapMarkersProps {
  markers?: Marker[];
  currentZoom?: number;
  viewport: MapboxViewport;
}

export const ClusteredMapMarkers: React.FC<ClusteredMapMarkersProps> = ({
  markers: propMarkers,
  currentZoom = 14,
  viewport,
}) => {
  // Get marker data from store
  const storeMarkers = useLocationStore((state) => state.markers);

  // Use the unified selection approach
  const selectedItem = useLocationStore((state) => state.selectedItem);
  const selectMapItem = useLocationStore((state) => state.selectMapItem);
  const isItemSelected = useLocationStore((state) => state.isItemSelected);

  const { publish } = useEventBroker();

  // Use provided markers or fall back to store markers
  const markers = propMarkers || storeMarkers;

  // Get clusters based on current markers, viewport, and zoom level
  const { clusters } = useMarkerClustering(markers, viewport, currentZoom);

  // Unified handler for both markers and clusters
  const handleMapItemPress = (item: MapItem) => {
    // Skip if already selected
    if (selectedItem?.id === item.id) {
      return;
    }

    // Select the item in the store
    selectMapItem(item);

    // Zoom to the item's location
    publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
      timestamp: Date.now(),
      source: "ClusteredMapMarkers",
      coordinates: item.coordinates,
      duration: 500,
      zoomLevel: currentZoom + (item.type === "cluster" ? 2 : 0), // Zoom in 2 levels for clusters
    });

    // Convert to the EventBroker's expected format
    if (item.type === "marker") {
      // Create the marker event item
      const markerEventItem: EventMarkerItem = {
        id: item.id,
        type: "marker",
        coordinates: item.coordinates,
        markerData: item.data,
      };

      // Publish the unified MAP_ITEM_SELECTED event
      publish<MapItemEvent>(EventTypes.MAP_ITEM_SELECTED, {
        timestamp: Date.now(),
        source: "ClusteredMapMarkers",
        item: markerEventItem,
      });

      // For backward compatibility, also publish the legacy event
      publish(EventTypes.MARKER_SELECTED, {
        timestamp: Date.now(),
        source: "ClusteredMapMarkers",
        markerId: item.id,
        markerData: item.data,
      });
    } else {
      // Create the cluster event item
      const clusterEventItem: EventClusterItem = {
        id: item.id,
        type: "cluster",
        coordinates: item.coordinates,
        count: item.count,
        childMarkers: item.childrenIds,
      };

      // Publish the unified MAP_ITEM_SELECTED event
      publish<MapItemEvent>(EventTypes.MAP_ITEM_SELECTED, {
        timestamp: Date.now(),
        source: "ClusteredMapMarkers",
        item: clusterEventItem,
      });

      // For backward compatibility, also publish the legacy event
      publish(EventTypes.CLUSTER_SELECTED, {
        timestamp: Date.now(),
        source: "ClusteredMapMarkers",
        clusterId: item.id,
        clusterInfo: {
          count: item.count,
          coordinates: item.coordinates,
        },
      });
    }
  };

  return (
    <>
      {/* Render clusters */}
      {clusters.map((feature) => {
        // If it's a cluster
        if (feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature;
          const coordinates = clusterFeature.geometry.coordinates;
          const count = clusterFeature.properties.point_count;
          const clusterId = `cluster-${clusterFeature.properties.cluster_id}`;

          // Create a cluster map item
          const clusterItem: ClusterItem = {
            id: clusterId,
            type: "cluster",
            coordinates: coordinates as [number, number],
            count,
          };

          return (
            <MapboxGL.MarkerView
              key={clusterId}
              coordinate={coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <ClusterMarker
                count={count}
                coordinates={coordinates}
                onPress={() => handleMapItemPress(clusterItem)}
                isSelected={isItemSelected(clusterId)}
              />
            </MapboxGL.MarkerView>
          );
        }
        // It's a single point
        else {
          const pointFeature = feature as PointFeature;
          const markerId = pointFeature.properties.id;
          const coordinates = pointFeature.geometry.coordinates;
          const data = pointFeature.properties.data;

          // Create a marker map item
          const markerItem: MarkerItem = {
            id: markerId,
            type: "marker",
            coordinates: coordinates as [number, number],
            data,
          };

          return (
            <MapboxGL.MarkerView
              key={`marker-${markerId}`}
              coordinate={coordinates}
              anchor={{ x: 0.5, y: 1.0 }}
            >
              <MysteryEmojiMarker
                event={{
                  title: data.title || "Unnamed Event",
                  emoji: data.emoji || "📍",
                  location: data.location || "Unknown location",
                  distance: data.distance || "Unknown distance",
                  time: data.time || new Date().toLocaleDateString(),
                  description: data.description || "",
                  categories: data.categories || [],
                  isVerified: data.isVerified || false,
                  color: data.color,
                }}
                isSelected={isItemSelected(markerId)}
                isHighlighted={false}
                onPress={() => handleMapItemPress(markerItem)}
              />
            </MapboxGL.MarkerView>
          );
        }
      })}
    </>
  );
};
