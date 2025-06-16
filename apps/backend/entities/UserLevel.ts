import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./User";
import { Level } from "./Level";

@Entity("user_levels")
@Index(["userId", "levelId"], { unique: true })
export class UserLevel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "level_id", type: "uuid" })
  levelId!: string;

  @Column({ name: "current_xp", type: "integer", default: 0 })
  currentXp!: number;

  @Column({ name: "is_completed", type: "boolean", default: false })
  isCompleted!: boolean;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date;

  @ManyToOne(() => User, (user) => user.userLevels, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @ManyToOne(() => Level, (level) => level.userLevels, { onDelete: "CASCADE" })
  @JoinColumn({ name: "level_id" })
  level!: Relation<Level>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
