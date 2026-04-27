import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from "typeorm";

export type CapabilityPhase = "bfs" | "dfs" | "won";

@Entity("capability_progress")
@Index(["userId"])
@Unique(["userId", "capabilityId"])
export class CapabilityProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "program_id", type: "varchar", length: 64 })
  programId!: string;

  @Column({ name: "capability_id", type: "varchar", length: 128 })
  capabilityId!: string;

  @Column({ type: "varchar", length: 8, default: "bfs" })
  phase!: CapabilityPhase;

  /** When phase=dfs, the locked enactment pattern the user is repping. */
  @Column({
    name: "active_pattern_id",
    type: "varchar",
    length: 128,
    nullable: true,
  })
  activePatternId?: string | null;

  /** Patterns the user has reps on (BFS coverage tracker). */
  @Column({
    name: "patterns_tried",
    type: "text",
    array: true,
    default: "{}",
  })
  patternsTried!: string[];

  /** Per-pattern rep + resonance ledger so transitions can be deterministic. */
  @Column({ name: "pattern_stats", type: "jsonb", default: () => "'{}'" })
  patternStats!: Record<string, { reps: number; avgResonance: number }>;

  @Column({ name: "reps_at_current_pattern", type: "int", default: 0 })
  repsAtCurrentPattern!: number;

  @Column({
    name: "avg_resonance",
    type: "numeric",
    precision: 4,
    scale: 3,
    default: 0,
  })
  avgResonance!: number;

  @Column({ name: "last_quest_id", type: "uuid", nullable: true })
  lastQuestId?: string | null;

  @Column({ name: "won_at", type: "timestamptz", nullable: true })
  wonAt?: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
