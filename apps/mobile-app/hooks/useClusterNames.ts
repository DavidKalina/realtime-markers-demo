// src/hooks/useClusterNames.ts
import { useState, useCallback } from "react";
import apiClient from "../services/ApiClient";

// These type definitions should match those in your ApiClient
interface ClusterFeature {
  id?: string;
  location?: [number, number]; // [longitude, latitude]
  pointCount?: number;
  eventIds?: string[];
}

interface GeocodingInfo {
  placeName: string;
  neighborhood?: string;
  locality?: string;
  place?: string;
  district?: string;
  region?: string;
  country?: string;
  poi?: string;
}

interface ClusterNameCache {
  name: string;
  geocodingInfo?: GeocodingInfo;
}

/**
 * Hook for generating AI-powered names for clusters with geocoding information
 */
export function useClusterNames() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Store both names and geocoding info in the cache
  const [clusterData, setClusterData] = useState<Record<string, ClusterNameCache>>({});

  /**
   * Generate a stable ID for a cluster
   */
  const generateClusterId = useCallback((cluster: ClusterFeature): string => {
    if (cluster.id) return cluster.id;
    if (cluster.location) {
      return `cluster-${cluster.location[0].toFixed(5)}-${cluster.location[1].toFixed(5)}-${
        cluster.pointCount || 0
      }`;
    }
    return `cluster-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /**
   * Generate names for multiple clusters at once
   */
  const generateNames = useCallback(
    async (
      clusters: ClusterFeature[],
      zoom: number,
      bounds?: {
        north: number;
        east: number;
        south: number;
        west: number;
      }
    ) => {
      if (clusters.length === 0) return {};

      setLoading(true);
      setError(null);

      try {
        // Prepare clusters with stable IDs if not provided
        const preparedClusters = clusters.map((cluster) => ({
          ...cluster,
          id: generateClusterId(cluster),
        }));

        // Call the API
        const results = await apiClient.generateClusterNames({
          clusters: preparedClusters,
          zoom,
          bounds,
        });

        // Convert results to a data map with names and geocoding info
        const dataMap: Record<string, ClusterNameCache> = {};
        results.forEach((result) => {
          dataMap[result.clusterId] = {
            name: result.generatedName,
            geocodingInfo: result.geocodingInfo,
          };
        });

        setClusterData((prevData) => ({ ...prevData, ...dataMap }));

        // Return just the names for backward compatibility
        const nameMap: Record<string, string> = {};
        results.forEach((result) => {
          nameMap[result.clusterId] = result.generatedName;
        });

        return nameMap;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error generating cluster names:", err);
        return {};
      } finally {
        setLoading(false);
      }
    },
    [generateClusterId]
  );

  /**
   * Get a name for a single cluster
   */
  const getClusterName = useCallback(
    (cluster: ClusterFeature, defaultName: string = "Event Cluster"): string => {
      const clusterId = generateClusterId(cluster);
      return clusterData[clusterId]?.name || defaultName;
    },
    [clusterData, generateClusterId]
  );

  /**
   * Get geocoding information for a single cluster
   */
  const getGeocodingInfo = useCallback(
    (cluster: ClusterFeature): GeocodingInfo | undefined => {
      const clusterId = generateClusterId(cluster);
      return clusterData[clusterId]?.geocodingInfo;
    },
    [clusterData, generateClusterId]
  );

  return {
    loading,
    error,
    clusterData, // Full data including names and geocoding info
    generateNames,
    getClusterName,
    getGeocodingInfo,
    generateClusterId,
  };
}

export default useClusterNames;
