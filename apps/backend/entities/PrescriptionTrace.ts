import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

export type PrescriptionTraceStatus = "in_progress" | "success" | "failure";

@Entity("prescription_traces")
@Index(["startedAt"])
@Index(["userId", "startedAt"])
export class PrescriptionTrace {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "sidequest_id", type: "uuid", nullable: true })
  sidequestId?: string | null;

  @Column({ name: "quest_index", type: "integer", nullable: true })
  questIndex?: number | null;

  @Column({ type: "varchar", length: 32, default: "in_progress" })
  status!: PrescriptionTraceStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage?: string | null;

  // Quick-access summary fields surfaced in the list view, denormalized so
  // the index page doesn't have to join the events table.
  @Column({ name: "venue_name", type: "varchar", length: 255, nullable: true })
  venueName?: string | null;

  @Column({ name: "venue_category", type: "varchar", length: 100, nullable: true })
  venueCategory?: string | null;

  @Column({
    name: "distance_from_home",
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceFromHome?: number | null;

  @Column({ name: "capacity_track", type: "varchar", length: 50, nullable: true })
  capacityTrack?: string | null;

  @Column({ name: "rep_intent", type: "varchar", length: 500, nullable: true })
  repIntent?: string | null;

  @Column({
    name: "home_base_viability",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  homeBaseViability?: string | null;

  @Column({ name: "recommended_city", type: "varchar", length: 100, nullable: true })
  recommendedCity?: string | null;

  @Column({
    name: "effective_reach_mode",
    type: "varchar",
    length: 32,
    nullable: true,
  })
  effectiveReachMode?: string | null;

  @CreateDateColumn({ name: "started_at" })
  startedAt!: Date;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date | null;

  @Column({ name: "duration_ms", type: "integer", nullable: true })
  durationMs?: number | null;

  @Column({ name: "total_events", type: "integer", default: 0 })
  totalEvents!: number;

  @Column({
    name: "total_llm_cost_usd",
    type: "numeric",
    precision: 10,
    scale: 6,
    default: 0,
  })
  totalLlmCostUsd!: number;
}
