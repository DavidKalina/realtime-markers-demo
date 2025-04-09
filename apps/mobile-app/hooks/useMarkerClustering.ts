// hooks/useMarkerClustering.ts
import { useMemo, useRef, useEffect } from "react";
import Supercluster from "supercluster";
import { Marker } from "@/hooks/useMapWebsocket";
import { MapboxViewport } from "@/types/types";

// Type for cluster properties
interface ClusterProperties {
  cluster: boolean;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
  stableId: string;
  childMarkers: string[];
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

// Helper function to generate a stable cluster ID using a hash
const generateClusterId = (markers: Marker[]): string => {
  // Use a simple but effective hash function
  const hash = markers.reduce((acc, marker) => {
    // XOR the current hash with the marker ID's hash
    return acc ^ marker.id.split('').reduce((charAcc, char) => {
      return ((charAcc << 5) - charAcc) + char.charCodeAt(0) | 0;
    }, 0);
  }, 0);

  return `cluster-${hash}`;
};

export const useMarkerClustering = (
  markers: Marker[],
  viewport: MapboxViewport | null,
  currentZoom: number
): ClusteringResult => {
  // Create a stable reference to supercluster instance
  const superclusterRef = useRef<Supercluster>();
  const lastZoomRef = useRef<number>(currentZoom);
  const debouncedZoomRef = useRef<number>(currentZoom);

  // Initialize supercluster only once
  if (!superclusterRef.current) {
    superclusterRef.current = new Supercluster({
      radius: 100,
      maxZoom: 16,
      minPoints: 2,
      map: (props) => ({
        id: props.id,
        data: props.data,
      }),
    });
  }

  // Debounce zoom level changes
  useEffect(() => {
    const zoomDiff = Math.abs(currentZoom - lastZoomRef.current);
    // Only update if zoom difference is significant (more than 0.1)
    if (zoomDiff > 0.1) {
      debouncedZoomRef.current = currentZoom;
      lastZoomRef.current = currentZoom;
    }
  }, [currentZoom]);

  // Convert markers to GeoJSON format and memoize
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

  // Memoize the bounds calculation
  const bounds = useMemo(() => {
    if (!viewport) return null;
    return [viewport.west, viewport.south, viewport.east, viewport.north] as [
      number,
      number,
      number,
      number
    ];
  }, [viewport]);

  // Load points into supercluster only when points change
  useMemo(() => {
    if (superclusterRef.current && points.length > 0) {
      superclusterRef.current.load(points);
    }
  }, [points]);

  // Generate clusters based on viewport and zoom
  const clusters = useMemo(() => {
    if (!viewport || !bounds || points.length === 0 || !superclusterRef.current) return [];

    // Get raw clusters from supercluster
    const rawClusters = superclusterRef.current.getClusters(bounds, Math.floor(debouncedZoomRef.current)) as (
      | ClusterFeature
      | PointFeature
    )[];

    // Process clusters to add stable IDs and child markers
    return rawClusters.map(cluster => {
      if (cluster.properties.cluster) {
        // For clusters, get the leaf markers and generate a stable ID
        const clusterFeature = cluster as ClusterFeature;
        const leaves = superclusterRef.current!.getLeaves(
          clusterFeature.properties.cluster_id,
          Infinity
        );
        const markerIds = leaves.map(leaf => (leaf as PointFeature).properties.id);
        const stableId = generateClusterId(markerIds.map(id => markers.find(m => m.id === id)!));

        // Log cluster information
        console.log('Cluster Processing:', {
          clusterId: clusterFeature.properties.cluster_id,
          pointCount: clusterFeature.properties.point_count,
          markerIdsCount: markerIds.length,
          markerIds: markerIds,
        });

        return {
          ...clusterFeature,
          properties: {
            ...clusterFeature.properties,
            stableId,
            childMarkers: markerIds,
          },
        };
      }
      return cluster;
    });
  }, [viewport, bounds, points.length, debouncedZoomRef.current, markers]);

  return {
    clusters,
  };
};
