import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { Sidequest } from "./Sidequest";

@Entity("objectives")
export class Objective {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "sidequest_id", type: "uuid" })
  sidequestId!: string;

  @ManyToOne(() => Sidequest, (s) => s.objectives, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sidequest_id" })
  sidequest!: Relation<Sidequest>;

  @Column({ name: "sort_order", type: "int" })
  sortOrder!: number;

  @Column({ type: "varchar", length: 500 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  emoji?: string;

  @Column({
    name: "estimated_cost",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedCost?: number;

  @Column({ name: "venue_name", type: "varchar", length: 500, nullable: true })
  venueName?: string;

  @Column({
    name: "venue_address",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  venueAddress?: string;

  @Column({
    name: "venue_category",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  venueCategory?: string;

  @Column({ type: "numeric", precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: "numeric", precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ type: "text", nullable: true })
  hook?: string;

  @Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
  checkedInAt?: Date;

  @Column({
    name: "entry_latitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  entryLatitude?: number;

  @Column({
    name: "entry_longitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  entryLongitude?: number;

  @Column({
    name: "entry_point_name",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  entryPointName?: string;

  @Column({ type: "text", nullable: true })
  embedding?: string;

  @Column({
    name: "suggested_activities",
    type: "text",
    array: true,
    default: "{}",
  })
  suggestedActivities!: string[];

  @Column({
    name: "action_items",
    type: "text",
    array: true,
    default: "{}",
  })
  actionItems!: string[];

  @Column({
    name: "completed_activity",
    type: "varchar",
    length: 2000,
    nullable: true,
  })
  completedActivity?: string;

  @Column({ name: "photo_url", type: "varchar", length: 500, nullable: true })
  photoUrl?: string;

  @Column({ name: "journal_prompt", type: "varchar", length: 500, nullable: true })
  journalPrompt?: string;

  @Column({ name: "journal_entry", type: "text", nullable: true })
  journalEntry?: string;

  @Column({ name: "social_context", type: "varchar", length: 50, nullable: true })
  socialContext?: string;

  @Column({ type: "smallint", nullable: true })
  difficulty?: number;

  @Column({ name: "reflection_depth", type: "real", nullable: true })
  reflectionDepth?: number;

  @Column({ name: "reflection_sentiment", type: "real", nullable: true })
  reflectionSentiment?: number;

  @Column({ name: "reflection_tags", type: "jsonb", nullable: true })
  reflectionTags?: string[];

  @Column({ type: "varchar", length: 20, nullable: true })
  actionability?: "actionable" | "suggestive" | "milestone";

  // ── Pre-quest expectancy predictions (inhibitory learning) ──

  @Column({ name: "predicted_anxiety", type: "smallint", nullable: true })
  predictedAnxiety?: number;

  @Column({ name: "predicted_difficulty", type: "smallint", nullable: true })
  predictedDifficulty?: number;

  @Column({ name: "predicted_outcome", type: "text", nullable: true })
  predictedOutcome?: string;
}
