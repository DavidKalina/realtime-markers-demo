// Types-only module — methods moved to ApiClient

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
