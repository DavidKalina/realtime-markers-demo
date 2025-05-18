// services/ClusterNamingService.ts
import { OpenAIService } from "./shared/OpenAIService";
import { CacheService } from "./shared/CacheService";
import { GeocodingService } from "./GeocodingService";

interface ClusterFeature {
  id?: string;
  title?: string;
  address?: string;
  location?: [number, number]; // [longitude, latitude]
  pointCount?: number;
  eventIds?: string[];
}

interface ClusterNamingRequest {
  clusters: ClusterFeature[];
  zoom: number;
  bounds?: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
}

interface ClusterNamingResult {
  clusterId: string;
  generatedName: string;
  geocodingInfo?: {
    placeName: string;
    neighborhood?: string;
    locality?: string;
    place?: string;
    region?: string;
  };
}

export class ClusterNamingService {
  private static instance: ClusterNamingService;
  private geocodingService: GeocodingService;

  private constructor() {
    this.geocodingService = GeocodingService.getInstance();
  }

  public static getInstance(): ClusterNamingService {
    if (!this.instance) {
      this.instance = new ClusterNamingService();
    }
    return this.instance;
  }

  /**
   * Generate names for multiple clusters at once
   */
  public async generateClusterNames(
    request: ClusterNamingRequest,
  ): Promise<ClusterNamingResult[]> {
    const results: ClusterNamingResult[] = [];

    for (const cluster of request.clusters) {
      const clusterId = cluster.id || this.generateClusterId(cluster);

      // Check cache first using the CacheService for consistency
      const cacheKey = `cluster_name:${clusterId}:${request.zoom}`;
      const cachedName = await CacheService.getCachedData(cacheKey);

      if (cachedName) {
        console.log(`Using cached cluster name for ${clusterId}`);
        try {
          // Parse cached result and append "Cluster" if not already there
          const parsed = JSON.parse(cachedName);

          // Ensure "Cluster" is appended
          if (!parsed.generatedName.endsWith(" Cluster")) {
            parsed.generatedName = `${parsed.generatedName} Cluster`;
          }

          results.push(parsed);
          continue;
        } catch (err) {
          // If parsing fails, use the string value directly with "Cluster" appended
          const name = cachedName.endsWith(" Cluster")
            ? cachedName
            : `${cachedName} Cluster`;

          results.push({
            clusterId,
            generatedName: name,
          });
          continue;
        }
      }

      // Generate new name if not in cache
      const result = await this.generateClusterName(
        cluster,
        request.zoom,
        request.bounds,
      );

      // Ensure "Cluster" is appended to the generated name
      if (!result.generatedName.endsWith(" Cluster")) {
        result.generatedName = `${result.generatedName} Cluster`;
      }

      // Cache the result with 1 day TTL (JSON stringified to preserve all properties)
      await CacheService.setCachedData(cacheKey, JSON.stringify(result), 86400);

      results.push(result);
    }

    return results;
  }

  /**
   * Generate a name for a single cluster using reverse geocoding plus AI enhancement
   */
  private async generateClusterName(
    cluster: ClusterFeature,
    zoom: number,
    bounds?: { north: number; east: number; south: number; west: number },
  ): Promise<ClusterNamingResult> {
    try {
      // First, get geocoding information if coordinates are available
      let geocodingInfo = null;
      const result: ClusterNamingResult = {
        clusterId: cluster.id || this.generateClusterId(cluster),
        generatedName: "Events Cluster", // Default fallback
      };

      if (cluster.location) {
        geocodingInfo = await this.geocodingService.reverseGeocode(
          cluster.location,
        );

        if (geocodingInfo) {
          // Save geocoding info to the result
          result.geocodingInfo = {
            placeName: geocodingInfo.placeName,
            neighborhood: geocodingInfo.neighborhood,
            locality: geocodingInfo.locality,
            place: geocodingInfo.place,
            region: geocodingInfo.region,
          };

          // Get the appropriate name for the current zoom level
          const baseLocationName =
            this.geocodingService.getAppropriateNameForZoom(
              geocodingInfo,
              zoom,
            );

          // For some cases, we can directly use the geocoded name without AI enhancement
          if (zoom <= 8 || !cluster.pointCount || cluster.pointCount < 3) {
            result.generatedName = baseLocationName;
            return result;
          }

          // For more complex cases, enhance the name with AI
          return await this.enhanceGeocodedName(
            cluster,
            zoom,
            geocodingInfo,
            result,
          );
        }
      }

      // If we don't have geocoding information, fall back to AI-only name generation
      return await this.generateAIOnlyName(cluster, zoom, result, bounds);
    } catch (error) {
      console.error("Error generating cluster name:", error);
      return {
        clusterId: cluster.id || this.generateClusterId(cluster),
        generatedName: "Events Cluster",
      };
    }
  }

  /**
   * Enhance a geocoded place name with AI to make it more descriptive
   */
  private async enhanceGeocodedName(
    cluster: ClusterFeature,
    zoom: number,
    geocodingInfo: any,
    result: ClusterNamingResult,
  ): Promise<ClusterNamingResult> {
    // Extract relevant information to include in the prompt
    const locationInfo = {
      primary: this.geocodingService.getAppropriateNameForZoom(
        geocodingInfo,
        zoom,
      ),
      neighborhood: geocodingInfo.neighborhood,
      locality: geocodingInfo.locality,
      place: geocodingInfo.place,
      district: geocodingInfo.district,
      region: geocodingInfo.region,
      poi: geocodingInfo.poi,
    };

    try {
      // Create the prompt for GPT-4o-mini with geocoding context
      // Note we've removed the instruction not to include "cluster" since we want it
      const response = await OpenAIService.executeChatCompletion({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a location-aware naming system. Your task is to generate concise, descriptive names for geographic clusters of events.
            
You will be provided with actual geocoding information for the area, and should generate a name that:
1. Uses the provided geocoding information as a foundation
2. Is natural and conversational while being accurate
3. Is very concise (2-4 words maximum)
4. Focuses on geographic/location identifiers
5. Do NOT add the word "Cluster" - that will be added later
6. Respond ONLY with the name, nothing else`,
          },
          {
            role: "user",
            content: `Create a short, descriptive geographic name for a cluster of ${
              cluster.pointCount || "multiple"
            } events.

Geocoding information:
- Primary location: ${locationInfo.primary}
- Neighborhood: ${locationInfo.neighborhood || "N/A"}
- Locality: ${locationInfo.locality || "N/A"}
- Place: ${locationInfo.place || "N/A"}
- District: ${locationInfo.district || "N/A"}
- Region: ${locationInfo.region || "N/A"}
- Point of Interest: ${locationInfo.poi || "N/A"}
- Current map zoom level: ${zoom}

Create a name that best represents this area at the given zoom level.`,
          },
        ],
        max_tokens: 30,
      });

      let generatedName =
        response.choices[0].message.content?.trim() || locationInfo.primary;

      // Cleanup and validation - remove quotes if present
      generatedName = generatedName.replace(/^["']|["']$/g, "");

      // If name is too long, just use the primary location name
      if (generatedName.length > 30) {
        generatedName = locationInfo.primary;
      }

      result.generatedName = generatedName;
      return result;
    } catch (error) {
      console.error("Error enhancing geocoded name:", error);
      // Fallback to just using the primary location name
      result.generatedName = locationInfo.primary || "Events Area";
      return result;
    }
  }

  /**
   * Generate a name using AI only, without geocoding information
   */
  private async generateAIOnlyName(
    cluster: ClusterFeature,
    zoom: number,
    result: ClusterNamingResult,
    bounds?: { north: number; east: number; south: number; west: number },
  ): Promise<ClusterNamingResult> {
    try {
      // Extract relevant information for prompt
      const locationInfo = cluster.location
        ? `at coordinates [${cluster.location[1]}, ${cluster.location[0]}]`
        : "";

      const addressInfo = cluster.address ? `near ${cluster.address}` : "";

      const pointCountInfo = cluster.pointCount
        ? `containing ${cluster.pointCount} events`
        : "";

      // Create the prompt for GPT-4o-mini
      // Note we've removed the instruction not to include "cluster" since we want it
      const response = await OpenAIService.executeChatCompletion({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a location-aware naming system. Your task is to generate concise, descriptive names for geographic clusters of events. 
            
Follow these guidelines:
1. Focus on geographic/location-based names that highlight the area
2. Keep names very short (2-4 words maximum)
3. Use natural, conversational language
4. Do NOT include the word "Cluster" - that will be added later
5. Prefer neighborhood, district, landmark or area names over city names when appropriate
6. Consider the zoom level when deciding specificity (higher zoom means more specific naming)
7. Respond ONLY with the name, nothing else`,
          },
          {
            role: "user",
            content: `Generate a short, descriptive geographic name for a cluster of events ${locationInfo} ${addressInfo} ${pointCountInfo}. Current map zoom level: ${zoom}.`,
          },
        ],
        max_tokens: 30,
      });

      let generatedName =
        response.choices[0].message.content?.trim() || "Event Area";

      // Cleanup and validation - remove quotes if present
      generatedName = generatedName.replace(/^["']|["']$/g, "");

      // If name is too long, truncate while preserving words
      if (generatedName.length > 30) {
        const words = generatedName.split(" ");
        generatedName = "";
        for (const word of words) {
          if ((generatedName + " " + word).length <= 30) {
            generatedName += (generatedName ? " " : "") + word;
          } else {
            break;
          }
        }
      }

      result.generatedName = generatedName;
      return result;
    } catch (error) {
      console.error("Error generating AI-only cluster name:", error);
      result.generatedName = "Event Area";
      return result;
    }
  }

  /**
   * Generate a stable ID for a cluster based on its properties
   */
  private generateClusterId(cluster: ClusterFeature): string {
    const data = {
      location: cluster.location,
      pointCount: cluster.pointCount,
      eventIds: cluster.eventIds?.slice(0, 5), // Use first 5 event IDs for stability
    };

    // Convert to string and create hash
    const dataString = JSON.stringify(data);
    return CacheService.getCacheKey(dataString);
  }
}
