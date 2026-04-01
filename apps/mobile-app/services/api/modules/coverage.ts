import { BaseApiModule } from "../base/BaseApiModule";
import type { BaseApiClient } from "../base/ApiClient";

export interface DirectionalGap {
  direction: string;
  angleDeg: number;
  gapWidthDeg: number;
}

export interface CoverageClusterData {
  latitude: number;
  longitude: number;
  visitCount: number;
  shade: number;
  venueCategories: string[];
}

export interface CoverageSummaryResponse {
  clusters: CoverageClusterData[];
  stats: {
    coveragePct: number;
    territorySqMiles: number;
    avgDensity: number;
    frontierMiles: number;
    clusterCount: number;
  };
  directionalGaps: DirectionalGap[];
  cellsGeojson?: GeoJSON.Geometry;
  canvasGeojson?: GeoJSON.Geometry;
  homeLatitude: number | null;
  homeLongitude: number | null;
}

export class CoverageModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getSummary(): Promise<CoverageSummaryResponse> {
    const url = `${this.client.baseUrl}/api/users/me/coverage`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<CoverageSummaryResponse>(response);
  }
}
