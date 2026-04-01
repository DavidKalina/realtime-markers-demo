import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("coverage_snapshots")
@Index(["userId"], { unique: true })
export class CoverageSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /**
   * GeoJSON FeatureCollection of Voronoi cells.
   * Each Feature has properties: { clusterId, shade, visitCount }
   */
  @Column({ name: "cells_geojson", type: "jsonb", nullable: true })
  cellsGeojson?: Record<string, unknown>;

  /**
   * GeoJSON Polygon of the canvas (buffered convex hull of all clusters + home).
   */
  @Column({ name: "canvas_geojson", type: "jsonb", nullable: true })
  canvasGeojson?: Record<string, unknown>;

  /** Shaded area / canvas area (0-1) */
  @Column({
    name: "coverage_pct",
    type: "numeric",
    precision: 5,
    scale: 2,
    default: 0,
  })
  coveragePct!: number;

  /** Total shaded area in square miles */
  @Column({
    name: "territory_sq_miles",
    type: "numeric",
    precision: 10,
    scale: 3,
    default: 0,
  })
  territorySqMiles!: number;

  /** Average shade intensity across all cells (0-1) */
  @Column({
    name: "avg_density",
    type: "numeric",
    precision: 4,
    scale: 3,
    default: 0,
  })
  avgDensity!: number;

  /** Total perimeter miles of shaded territory border */
  @Column({
    name: "frontier_miles",
    type: "numeric",
    precision: 10,
    scale: 3,
    default: 0,
  })
  frontierMiles!: number;

  /** Number of clusters feeding this snapshot */
  @Column({ name: "cluster_count", type: "int", default: 0 })
  clusterCount!: number;

  /** Directional gap analysis from home anchor */
  @Column({ name: "directional_gaps", type: "jsonb", nullable: true })
  directionalGaps?: Array<{
    direction: string;
    angleDeg: number;
    gapWidthDeg: number;
  }>;

  @CreateDateColumn({ name: "computed_at", type: "timestamptz" })
  computedAt!: Date;
}
