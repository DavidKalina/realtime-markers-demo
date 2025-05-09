// hooks/useMarkerClustering.ts
import { useMemo } from "react";
import Supercluster from "supercluster";
import type { Marker } from "@/hooks/useMapWebsocket";
import type { MapboxViewport } from "@/types/types";
import type { Point as GeoJSONPoint } from "geojson";

// --- Original Type Definitions (Ensuring Compatibility) ---

interface ClusterProperties {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
  stableId: string;
  childMarkers: string[];
}

interface PointProperties {
  cluster?: false;
  id: string;
  data: Marker["data"];
}

type OutputPointGeometry = {
  type: "Point";
  coordinates: [number, number];
};

export interface ClusterFeature {
  type: "Feature";
  properties: ClusterProperties;
  geometry: OutputPointGeometry;
}

export interface PointFeature {
  type: "Feature";
  properties: {
    cluster: false;
    id: string;
    data: Marker["data"];
  };
  geometry: OutputPointGeometry;
}

export interface ClusteringResult {
  clusters: (ClusterFeature | PointFeature)[];
}

// --- Internal Types ---

interface SuperclusterClusterPropertiesInternal {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
}

type InputPointFeatureInternal = GeoJSON.Feature<GeoJSONPoint, PointProperties>;

type SuperclusterClusterFeatureInternal = GeoJSON.Feature<
  GeoJSONPoint,
  SuperclusterClusterPropertiesInternal
>;

// --- Helper Functions ---

const generateStableClusterId = (markerIds: string[]): string => {
  const sortedIds = [...markerIds].sort();
  let hash = 0;
  for (const id of sortedIds) {
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    hash ^= sortedIds.length;
  }
  return `cluster-${hash}`;
};

// --- Hook Implementation ---

// Define Supercluster options with correct generics
const SUPERCLUSTER_OPTIONS: Supercluster.Options<
  PointProperties,
  SuperclusterClusterPropertiesInternal
> = {
  radius: 80,
  maxZoom: 16,
  minZoom: 0,
  minPoints: 2,
  map: ((props: PointProperties): PointProperties => props) as any,
};

export const useMarkerClustering = (
  markers: Marker[],
  viewport: MapboxViewport | null,
  currentZoom: number
): ClusteringResult => {
  // Memoize GeoJSON points
  const points: InputPointFeatureInternal[] = useMemo(() => {
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
        } as InputPointFeatureInternal)
    );
  }, [markers]);

  // Memoize the Supercluster instance with the current points
  const supercluster = useMemo(() => {
    const sc = new Supercluster(SUPERCLUSTER_OPTIONS);
    sc.load(points);
    return sc;
  }, [points]);

  // Memoize bounds
  const bounds: [number, number, number, number] | null = useMemo(() => {
    if (!viewport) return null;
    return [viewport.west, viewport.south, viewport.east, viewport.north];
  }, [viewport]);

  // Memoize integer zoom
  const integerZoom = useMemo(() => Math.floor(currentZoom), [currentZoom]);

  // Memoize raw clusters/points from supercluster
  const rawClustersAndPoints = useMemo(() => {
    if (!bounds || points.length === 0) {
      return [];
    }
    return supercluster.getClusters(bounds, integerZoom) as (
      | SuperclusterClusterFeatureInternal
      | InputPointFeatureInternal
    )[];
  }, [bounds, integerZoom, supercluster]);

  // Memoize final processed clusters mapped to output format
  const processedClusters = useMemo((): (ClusterFeature | PointFeature)[] => {
    return rawClustersAndPoints.map((feature): ClusterFeature | PointFeature => {
      if (feature.properties?.cluster === true) {
        // Cluster
        const clusterFeatureInternal = feature as SuperclusterClusterFeatureInternal;
        const clusterId = clusterFeatureInternal.properties.cluster_id;
        let childMarkerIds: string[] = [];

        try {
          const leaves = supercluster.getLeaves(clusterId, Infinity) as InputPointFeatureInternal[];
          childMarkerIds = leaves.map((leaf) => leaf.properties.id);
        } catch (error) {
          console.error(`Error getting leaves for cluster ${clusterId}:`, error);
        }

        const stableId = generateStableClusterId(childMarkerIds);
        const outputGeometry: OutputPointGeometry = {
          type: "Point",
          coordinates: clusterFeatureInternal.geometry.coordinates as [number, number],
        };

        return {
          type: "Feature",
          properties: {
            ...clusterFeatureInternal.properties,
            stableId,
            childMarkers: childMarkerIds,
          },
          geometry: outputGeometry,
        };
      } else {
        // Point
        const pointFeatureInternal = feature as InputPointFeatureInternal;
        const outputGeometry: OutputPointGeometry = {
          type: "Point",
          coordinates: pointFeatureInternal.geometry.coordinates as [number, number],
        };

        return {
          type: "Feature",
          properties: {
            cluster: false,
            id: pointFeatureInternal.properties.id,
            data: pointFeatureInternal.properties.data,
          },
          geometry: outputGeometry,
        };
      }
    });
  }, [rawClustersAndPoints, supercluster]);

  return {
    clusters: processedClusters,
  };
};
