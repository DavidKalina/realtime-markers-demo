import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("pathways")
@Index(["userId"])
export class Pathway {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 200 })
  theme!: string;

  @Column({ name: "theme_label", type: "varchar", length: 200, nullable: true })
  themeLabel?: string;

  @Column({
    name: "venue_categories",
    type: "text",
    array: true,
    default: "{}",
  })
  venueCategories!: string[];

  @Column({
    name: "avg_resonance",
    type: "numeric",
    precision: 4,
    scale: 3,
    default: 0,
  })
  avgResonance!: number;

  @Column({ name: "quest_count", type: "int", default: 0 })
  questCount!: number;

  @Column({ name: "current_difficulty", type: "smallint", default: 1 })
  currentDifficulty!: number;

  @Column({
    name: "difficulty_trend",
    type: "numeric",
    precision: 4,
    scale: 3,
    default: 0,
  })
  difficultyTrend!: number;

  @Column({ type: "varchar", length: 10, default: "bfs" })
  phase!: string;

  @Column({ name: "sidequest_ids", type: "uuid", array: true, default: "{}" })
  sidequestIds!: string[];

  @Column({ name: "resonance_scores", type: "jsonb", nullable: true })
  resonanceScores?: { sidequestId: string; score: number }[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
