import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { User } from "./User";
import { Objective } from "./Objective";

export enum SidequestStatus {
  GENERATING = "GENERATING",
  READY = "READY",
  FAILED = "FAILED",
}

export enum SidequestTier {
  QUICK = "QUICK",
  SWEET_SPOT = "SWEET_SPOT",
  BEST = "BEST",
}

/**
 * Capacity tracks (Slice C). Every prescription trains one capacity muscle —
 * the strategist picks this BEFORE choosing a venue. Venue is the environment;
 * track + rep intent are the prescription.
 */
export enum CapacityTrack {
  /** Getting ready, leaving the house, starting despite inertia. */
  ACTIVATION = "ACTIVATION",
  /** Being visible in public without fleeing. */
  PUBLIC_PRESENCE = "PUBLIC_PRESENCE",
  /** Entering unfamiliar places. */
  NOVELTY_TOLERANCE = "NOVELTY_TOLERANCE",
  /** Remaining somewhere long enough for anxiety to settle. */
  STAYING_POWER = "STAYING_POWER",
  /** Going back until a place feels familiar. */
  RETURNABILITY = "RETURNABILITY",
  /** Ordering, asking, thanking, eye contact, small talk. */
  MICRO_INTERACTION = "MICRO_INTERACTION",
  /** Joining, chatting, flirting, following up. */
  SOCIAL_EXTENSION = "SOCIAL_EXTENSION",
  /** Reflecting, regulating, trying again after awkwardness. */
  RECOVERY = "RECOVERY",
  /** Collecting proof that "I am someone who does this." */
  IDENTITY_EVIDENCE = "IDENTITY_EVIDENCE",
}

export const CAPACITY_TRACK_LABELS: Record<CapacityTrack, string> = {
  [CapacityTrack.ACTIVATION]: "Activation",
  [CapacityTrack.PUBLIC_PRESENCE]: "Public Presence",
  [CapacityTrack.NOVELTY_TOLERANCE]: "Novelty Tolerance",
  [CapacityTrack.STAYING_POWER]: "Staying Power",
  [CapacityTrack.RETURNABILITY]: "Returnability",
  [CapacityTrack.MICRO_INTERACTION]: "Micro-Interaction",
  [CapacityTrack.SOCIAL_EXTENSION]: "Social Extension",
  [CapacityTrack.RECOVERY]: "Recovery",
  [CapacityTrack.IDENTITY_EVIDENCE]: "Identity Evidence",
};

export type GoalActionType =
  | "none"
  | "dating_app_invite"
  | "suggest_coffee"
  | "ask_contact"
  | "natural_invitation"
  | "other_direct_goal_action";

@Entity("sidequests")
export class Sidequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Index()
  @Column({ type: "varchar", length: 255 })
  city!: string;

  @Column({ type: "text", nullable: true })
  prompt?: string;

  @Column({
    name: "radius_miles",
    type: "numeric",
    precision: 5,
    scale: 1,
    nullable: true,
  })
  radiusMiles?: number;

  @Column({
    name: "budget_max",
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetMax!: number;

  @Column({ type: "varchar", length: 500, nullable: true })
  title?: string;

  @Column({ type: "text", nullable: true })
  summary?: string;

  @Column({
    type: "enum",
    enum: SidequestStatus,
    default: SidequestStatus.GENERATING,
  })
  status!: SidequestStatus;

  @Column({ name: "activity_types", type: "text", array: true, default: "{}" })
  activityTypes!: string[];

  @Column({ type: "varchar", length: 50, nullable: true })
  intention?: string;

  @Column({
    type: "enum",
    enum: SidequestTier,
    nullable: true,
  })
  tier?: SidequestTier;

  // Self-reference: child options link to parent shell
  @Index()
  @Column({ name: "parent_id", type: "uuid", nullable: true })
  parentId?: string;

  @ManyToOne(() => Sidequest, (s) => s.children, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "parent_id" })
  parent?: Relation<Sidequest>;

  @OneToMany(() => Sidequest, (s) => s.parent)
  children!: Relation<Sidequest[]>;

  @Index({ unique: true })
  @Column({ name: "share_token", type: "uuid", nullable: true })
  shareToken?: string;

  @Column({ type: "smallint", nullable: true })
  rating?: number;

  @Column({ name: "rating_comment", type: "text", nullable: true })
  ratingComment?: string;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date;

  @Column({ name: "promoted_at", type: "timestamptz", nullable: true })
  promotedAt?: Date;

  @Column({ name: "is_published", type: "boolean", default: false })
  isPublished!: boolean;

  @Column({ name: "times_adopted", type: "int", default: 0 })
  timesAdopted!: number;

  @Column({ type: "text", nullable: true })
  embedding?: string;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  categories!: string[];

  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
  })
  rarity?: string;

  @Column({ type: "boolean", default: false })
  prescribed!: boolean;

  // ── Batch grouping ──────────────────────────────────────────
  @Index()
  @Column({ name: "batch_id", type: "uuid", nullable: true })
  batchId?: string;

  @Column({ name: "batch_index", type: "smallint", nullable: true })
  batchIndex?: number;

  // ── Pathway context (denormalized at prescription time) ─────
  @Column({ name: "pathway_id", type: "uuid", nullable: true })
  pathwayId?: string;

  @Column({ name: "pathway_theme", type: "varchar", length: 100, nullable: true })
  pathwayTheme?: string;

  @Column({ name: "pathway_label", type: "varchar", length: 200, nullable: true })
  pathwayLabel?: string;

  @Column({ name: "pathway_phase", type: "varchar", length: 10, nullable: true })
  pathwayPhase?: string;

  @Column({ name: "quest_type", type: "varchar", length: 20, default: "venue" })
  questType!: string;

  @Column({ name: "challenge_category", type: "varchar", length: 50, nullable: true })
  challengeCategory?: string;

  @Column({ name: "quest_role", type: "varchar", length: 20, nullable: true })
  questRole?: string;

  @Column({ name: "strategy_note", type: "text", nullable: true })
  strategyNote?: string;

  @Column({ name: "ai_reflection", type: "text", nullable: true })
  aiReflection?: string;

  // ── Capacity rep (Slice C) ──
  // The strategist picks ONE capacity track per prescription before selecting
  // a venue. `repIntent` is the strategist's one-line description of what
  // specific rep the user is training — distinct from the venue description.

  @Column({
    name: "capacity_track",
    type: "enum",
    enum: CapacityTrack,
    nullable: true,
  })
  capacityTrack?: CapacityTrack;

  @Column({ name: "rep_intent", type: "varchar", length: 500, nullable: true })
  repIntent?: string;

  @Column({ name: "opportunity_scope", type: "varchar", length: 50, nullable: true })
  opportunityScope?: string;

  @Column({ name: "travel_rationale", type: "text", nullable: true })
  travelRationale?: string;

  @Column({ name: "goal_milestone_key", type: "varchar", length: 100, nullable: true })
  goalMilestoneKey?: string;

  @Column({ name: "goal_milestone_title", type: "varchar", length: 200, nullable: true })
  goalMilestoneTitle?: string;

  @Column({ name: "direct_goal_touch", type: "boolean", nullable: true })
  directGoalTouch?: boolean;

  @Column({ name: "goal_action_type", type: "varchar", length: 50, nullable: true })
  goalActionType?: GoalActionType;

  @Column({
    name: "distance_from_home",
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceFromHome?: number;

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

  @OneToMany(() => Objective, (o) => o.sidequest, { cascade: true })
  objectives!: Relation<Objective[]>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt?: Date;
}
