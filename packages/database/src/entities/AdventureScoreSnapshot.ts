import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("adventure_score_snapshots")
@Index("IDX_ass_user_computed", ["userId", "computedAt"])
export class AdventureScoreSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ type: "integer" })
  score!: number;

  @Column({ name: "activity_score", type: "integer" })
  activityScore!: number;

  @Column({ name: "consistency_score", type: "integer" })
  consistencyScore!: number;

  @Column({ name: "diversity_score", type: "integer" })
  diversityScore!: number;

  @Column({ name: "completion_score", type: "integer" })
  completionScore!: number;

  @Column({ name: "discovery_score", type: "integer" })
  discoveryScore!: number;

  @CreateDateColumn({ name: "computed_at", type: "timestamptz" })
  computedAt!: Date;
}
