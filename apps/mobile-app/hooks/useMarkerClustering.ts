// hooks/useMarkerClustering.ts
import { useMemo } from "react";
import Supercluster from "supercluster";
import { Marker } from "@/hooks/useMapWebsocket";
import { MapboxViewport } from "@/types/types";

// Type for cluster properties
interface ClusterProperties {
  cluster: boolean;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
}

// Type for cluster feature
export interface ClusterFeature {
  type: "Feature";
  properties: ClusterProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

// Type for point feature
export interface PointFeature {
  type: "Feature";
  properties: {
    cluster: false;
    id: string;
    data: Marker["data"];
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

// Type for the result of the hook
export interface ClusteringResult {
  clusters: (ClusterFeature | PointFeature)[];
}

export const useMarkerClustering = (
  markers: Marker[],
  viewport: MapboxViewport | null,
  currentZoom: number
): ClusteringResult => {
  // Create a new supercluster instance
  const supercluster = useMemo(() => {
    return new Supercluster({
      radius: 40, // Clustering radius in pixels
      maxZoom: 16, // Maximum zoom level for clustering
      minPoints: 2, // Minimum points to form a cluster
      map: (props) => ({
        id: props.id,
        data: props.data,
      }),
    });
  }, []);

  // Convert markers to GeoJSON format
  const points = useMemo(() => {
    return markers.map(
      (marker) =>
        ({
          type: "Feature",
          properties: {
            cluster: false,
            id: marker.id,
            data: marker.data,
          },
          geometry: {
            type: "Point",
            coordinates: marker.coordinates,
          },
        } as PointFeature)
    );
  }, [markers]);

  // Generate clusters based on viewport and zoom
  const clusters = useMemo(() => {
    if (!viewport || points.length === 0) return [];

    // Load points into supercluster each time
    supercluster.load(points);

    // Get bounds from the viewport
    const bounds = [viewport.west, viewport.south, viewport.east, viewport.north] as [
      number,
      number,
      number,
      number
    ];

    // Get clusters and points for the current viewport
    return supercluster.getClusters(bounds, Math.floor(currentZoom)) as (
      | ClusterFeature
      | PointFeature
    )[];
  }, [viewport, points, supercluster, currentZoom]);

  return {
    clusters,
  };
};
