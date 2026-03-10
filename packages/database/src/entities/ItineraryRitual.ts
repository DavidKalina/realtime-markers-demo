import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { User } from "./User";

@Entity("itinerary_rituals")
export class ItineraryRitual {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 4, default: "🔁" })
  emoji!: string;

  @Column({
    name: "budget_min",
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetMin!: number;

  @Column({
    name: "budget_max",
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetMax!: number;

  @Column({ name: "duration_hours", type: "numeric", precision: 4, scale: 1 })
  durationHours!: number;

  @Column({ name: "activity_types", type: "text", array: true, default: "{}" })
  activityTypes!: string[];

  @Column({ name: "stop_count", type: "int", default: 0 })
  stopCount!: number;

  @Column({ name: "category_names", type: "text", array: true, default: "{}" })
  categoryNames!: string[];

  @Column({ name: "usage_count", type: "int", default: 0 })
  usageCount!: number;

  @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
