// components/Markers/ClusteredMapMarkers.tsx
import React from "react";
import MapboxGL from "@rnmapbox/maps";
import { useLocationStore } from "@/stores/useLocationStore";
import { MysteryEmojiMarker } from "./CustomMapMarker";
import { ClusterMarker } from "./ClusterMarker";
import { useMarkerClustering, ClusterFeature, PointFeature } from "@/hooks/useMarkerClustering";
import { Marker } from "@/hooks/useMapWebsocket";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, CameraAnimateToLocationEvent } from "@/services/EventBroker";
import { MapboxViewport } from "@/types/types";

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
  const selectedMarkerId = useLocationStore((state) => state.selectedMarkerId);
  const selectedItemType = useLocationStore((state) => state.selectedItemType);
  const selectMarker = useLocationStore((state) => state.selectMarker);
  const selectCluster = useLocationStore((state) => state.selectCluster);

  const { publish } = useEventBroker();

  // Use provided markers or fall back to store markers
  const markers = propMarkers || storeMarkers;

  // Get clusters based on current markers, viewport, and zoom level
  const { clusters } = useMarkerClustering(markers, viewport, currentZoom);

  // Handle individual marker selection
  // Update your ClusteredMapMarkers component

  // In your handleMarkerPress function:
  const handleMarkerPress = (marker: Marker) => {
    // Skip if already selected
    if (selectedMarkerId === marker.id && selectedItemType === "marker") {
      return;
    }

    // Select the marker in the store
    selectMarker(marker.id);

    // Emit an event for the marker selection (this will be picked up by useMarkerEffects)
    publish(EventTypes.MARKER_SELECTED, {
      type: EventTypes.MARKER_SELECTED,
      timestamp: Date.now(),
      source: "ClusteredMapMarkers",
      markerId: marker.id,
      markerData: marker,
    });
  };

  // In your handleClusterPress function:
  const handleClusterPress = (cluster: ClusterFeature) => {
    // Get cluster details
    const clusterId = `cluster-${cluster.properties.cluster_id}`;

    // Skip if already selected
    const currentSelectedCluster = useLocationStore.getState().selectedCluster;

    console.log(
      cluster,
      currentSelectedCluster,
      selectedItemType === "cluster" && currentSelectedCluster?.id === clusterId
    );

    if (selectedItemType === "cluster" && currentSelectedCluster?.id === clusterId) {
      return;
    }

    // Store the cluster in the location store
    selectCluster(cluster);

    // Emit a special event for cluster selection
    publish(EventTypes.CLUSTER_SELECTED, {
      type: EventTypes.CLUSTER_SELECTED,
      timestamp: Date.now(),
      source: "ClusteredMapMarkers",
      clusterId: clusterId,
      clusterInfo: {
        count: cluster.properties.point_count,
        coordinates: cluster.geometry.coordinates,
      },
    });

    // Zoom to the cluster
    publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
      timestamp: Date.now(),
      source: "ClusteredMapMarkers",
      coordinates: cluster.geometry.coordinates,
      duration: 500,
      zoomLevel: currentZoom + 2, // Zoom in 2 levels
    });
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

          // Check if this cluster is selected
          const isSelected =
            selectedItemType === "cluster" &&
            useLocationStore.getState().selectedCluster?.id === clusterId;

          return (
            <MapboxGL.MarkerView
              key={clusterId}
              coordinate={coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <ClusterMarker
                count={count}
                coordinates={coordinates}
                onPress={() => handleClusterPress(clusterFeature)}
                isSelected={isSelected}
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
                isSelected={selectedMarkerId === markerId && selectedItemType === "marker"}
                isHighlighted={false}
                onPress={() => handleMarkerPress({ id: markerId, coordinates, data })}
              />
            </MapboxGL.MarkerView>
          );
        }
      })}
    </>
  );
};
