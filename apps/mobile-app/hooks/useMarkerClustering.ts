// hooks/useMarkerClustering.ts
import { useMemo } from "react";
import Supercluster from "supercluster";
import type { Marker } from "@/hooks/useMapWebsocket";
import type { MapboxViewport } from "@/types/types";
import type { Point as GeoJSONPoint } from "geojson";
import { useDebounce } from "@/hooks/useDebounce"; // Assuming useDebounce is in a separate file

// --- Type Definitions and Helper Functions (ClusterProperties, PointProperties, etc.) ---
// (These remain the same as in your provided snippet)
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
  currentZoom: number,
  debounceMs: number = 200 // Configurable debounce delay
): ClusteringResult => {
  // Debounce viewport and zoom, which change frequently during map interactions
  const debouncedViewport = useDebounce(viewport, debounceMs);
  const debouncedCurrentZoom = useDebounce(currentZoom, debounceMs);

  // 1. Memoize GeoJSON points: Updates immediately when 'markers' change.
  // This ensures the underlying data for clustering is always fresh.
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

  // 2. Memoize the Supercluster instance: Rebuilds its index when 'points' (markers) change.
  const supercluster = useMemo(() => {
    const sc = new Supercluster(SUPERCLUSTER_OPTIONS);
    sc.load(points);
    return sc;
  }, [points]);

  // 3. Memoize bounds based on the *debounced* viewport.
  const bounds: [number, number, number, number] | null = useMemo(() => {
    if (!debouncedViewport) return null;
    return [
      debouncedViewport.west,
      debouncedViewport.south,
      debouncedViewport.east,
      debouncedViewport.north,
    ];
  }, [debouncedViewport]);

  // 4. Memoize integer zoom based on the *debounced* current zoom.
  const integerZoom = useMemo(() => {
    return Math.floor(debouncedCurrentZoom);
  }, [debouncedCurrentZoom]);

  // 5. Memoize the raw cluster/point data from Supercluster.
  // This operation (getClusters) is the most expensive part tied to view changes.
  // It now uses debounced bounds and zoom, but the up-to-date 'supercluster' instance.
  const clustersToProcess = useMemo(() => {
    if (!bounds || points.length === 0) {
      // Use points.length for initial empty state or if supercluster isn't ready
      return [];
    }
    // 'supercluster' here will have the latest markers loaded.
    // 'bounds' and 'integerZoom' are from debounced view parameters.
    return supercluster.getClusters(bounds, integerZoom) as (
      | SuperclusterClusterFeatureInternal
      | InputPointFeatureInternal
    )[];
  }, [bounds, integerZoom, supercluster, points.length]); // points.length helps ensure correct behavior if markers become empty

  // 6. Memoize the final processed clusters, mapping to the output format.
  // This depends on 'clustersToProcess' and the 'supercluster' instance (for getLeaves).
  const processedClusters = useMemo((): (ClusterFeature | PointFeature)[] => {
    return clustersToProcess.map((feature): ClusterFeature | PointFeature => {
      if (feature.properties?.cluster === true) {
        const clusterFeatureInternal = feature as SuperclusterClusterFeatureInternal;
        const clusterId = clusterFeatureInternal.properties.cluster_id;
        let childMarkerIds: string[] = [];
        try {
          // Critical: getLeaves uses the 'supercluster' instance that corresponds
          // to the one that generated 'clustersToProcess'.
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
  }, [clustersToProcess, supercluster]); // Ensure 'supercluster' is a dependency for 'getLeaves'

  return {
    clusters: processedClusters,
  };
};
