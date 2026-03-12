import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./User";

@Entity("user_badges")
@Unique(["userId", "badgeId"])
@Index(["userId"])
export class UserBadge {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ name: "badge_id", type: "varchar", length: 50 })
  badgeId!: string;

  @Column({ type: "integer", default: 0 })
  progress!: number;

  @CreateDateColumn({ name: "unlocked_at", type: "timestamptz", nullable: true })
  unlockedAt?: Date;
}
