// hooks/useMarkerClustering.ts
import { useMemo, useRef, useEffect } from "react";
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
// P = PointProperties (input point props, also stored for leaves)
// C = SuperclusterClusterPropertiesInternal (props supercluster adds to clusters)
const SUPERCLUSTER_OPTIONS: Supercluster.Options<
  PointProperties,
  SuperclusterClusterPropertiesInternal
> = {
  radius: 80,
  maxZoom: 16,
  minZoom: 0,
  minPoints: 2,
  // Correct map function logic: Returns the properties needed for leaves.
  // **Workaround:** Cast to 'any' to bypass TS error where it incorrectly expects
  // the return type to match the second generic (C) instead of P or a derivative of P.
  map: ((props: PointProperties): PointProperties => props) as any,
};

export const useMarkerClustering = (
  markers: Marker[],
  viewport: MapboxViewport | null,
  currentZoom: number
): ClusteringResult => {
  // useRef type matches the generics used in SUPERCLUSTER_OPTIONS
  const superclusterRef = useRef<Supercluster<
    PointProperties,
    SuperclusterClusterPropertiesInternal
  > | null>(null);

  // Memoize GeoJSON points
  const points: InputPointFeatureInternal[] = useMemo(() => {
    return markers.map(
      (marker) =>
        ({
          type: "Feature",
          properties: {
            cluster: false, // Explicitly false for input
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

  // Effect to initialize and load points
  useEffect(() => {
    if (!superclusterRef.current) {
      superclusterRef.current = new Supercluster(SUPERCLUSTER_OPTIONS);
    }
    superclusterRef.current.load(points);
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
    const sc = superclusterRef.current;
    if (!sc || !bounds || points.length === 0) {
      return [];
    }
    // Expecting clusters with SuperclusterClusterPropertiesInternal
    // and points with PointProperties (due to our map function logic)
    return sc.getClusters(bounds, integerZoom) as (
      | SuperclusterClusterFeatureInternal
      | InputPointFeatureInternal
    )[];
  }, [bounds, integerZoom, points]);

  // Memoize final processed clusters mapped to output format
  const processedClusters = useMemo((): (ClusterFeature | PointFeature)[] => {
    const sc = superclusterRef.current;
    if (!sc) return [];

    return rawClustersAndPoints.map((feature): ClusterFeature | PointFeature => {
      if (feature.properties?.cluster === true) {
        // Cluster
        const clusterFeatureInternal = feature as SuperclusterClusterFeatureInternal;
        const clusterId = clusterFeatureInternal.properties.cluster_id;
        let childMarkerIds: string[] = [];

        try {
          // Expect leaves to have PointProperties because map returned PointProperties
          const leaves = sc.getLeaves(clusterId, Infinity) as InputPointFeatureInternal[];
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
            // Conforms to ClusterProperties
            ...clusterFeatureInternal.properties, // Includes cluster, cluster_id, point_count, etc.
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
            // Conforms to PointFeature['properties']
            cluster: false, // Explicitly false
            id: pointFeatureInternal.properties.id,
            data: pointFeatureInternal.properties.data,
          },
          geometry: outputGeometry,
        };
      }
    });
  }, [rawClustersAndPoints]);

  return {
    clusters: processedClusters,
  };
};
