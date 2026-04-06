import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("goal_reflections")
@Index(["userId"])
export class GoalReflection {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 50 })
  milestone!: string;

  @Column({ name: "journal_entry", type: "text" })
  journalEntry!: string;

  @Column({ name: "journal_prompt", type: "text", nullable: true })
  journalPrompt?: string;

  @Column({ name: "percent_elapsed", type: "smallint", nullable: true })
  percentElapsed?: number;

  @Column({ name: "remaining_days", type: "smallint", nullable: true })
  remainingDays?: number;

  @Column({ name: "completed_quest_count", type: "smallint", nullable: true })
  completedQuestCount?: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
