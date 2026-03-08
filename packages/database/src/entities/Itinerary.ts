import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { User } from "./User";
import { ItineraryItem } from "./ItineraryItem";

export enum ItineraryStatus {
  GENERATING = "GENERATING",
  READY = "READY",
  FAILED = "FAILED",
}

@Entity("itineraries")
export class Itinerary {
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

  @Column({ name: "planned_date", type: "date" })
  plannedDate!: string;

  @Column({ name: "budget_min", type: "numeric", precision: 10, scale: 2, default: 0 })
  budgetMin!: number;

  @Column({ name: "budget_max", type: "numeric", precision: 10, scale: 2, default: 0 })
  budgetMax!: number;

  @Column({ name: "duration_hours", type: "numeric", precision: 4, scale: 1 })
  durationHours!: number;

  @Column({ name: "activity_types", type: "text", array: true, default: "{}" })
  activityTypes!: string[];

  @Column({ type: "varchar", length: 500, nullable: true })
  title?: string;

  @Column({ type: "text", nullable: true })
  summary?: string;

  @Column({
    type: "enum",
    enum: ItineraryStatus,
    default: ItineraryStatus.GENERATING,
  })
  status!: ItineraryStatus;

  @Index({ unique: true })
  @Column({ name: "share_token", type: "uuid", nullable: true })
  shareToken?: string;

  @OneToMany(() => ItineraryItem, (item) => item.itinerary, { cascade: true })
  items!: Relation<ItineraryItem[]>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
