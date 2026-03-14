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

  @Column({ type: "varchar", length: 50, nullable: true })
  intention?: string;

  @Column({ type: "jsonb", nullable: true })
  forecast?: Record<string, unknown>;

  @Column({ type: "smallint", nullable: true })
  rating?: number;

  @Column({ name: "rating_comment", type: "text", nullable: true })
  ratingComment?: string;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date;

  @Column({ name: "is_published", type: "boolean", default: false })
  isPublished!: boolean;

  @Column({ name: "times_adopted", type: "int", default: 0 })
  timesAdopted!: number;

  @Column({ type: "text", nullable: true })
  embedding?: string;

  @Column({ type: "text", array: true, default: "'{}'" })
  categories!: string[];

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

  @Column({ name: "source_itinerary_id", type: "uuid", nullable: true })
  sourceItineraryId?: string;

  @ManyToOne(() => Itinerary, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "source_itinerary_id" })
  sourceItinerary?: Relation<Itinerary>;

  @OneToMany(() => ItineraryItem, (item) => item.itinerary, { cascade: true })
  items!: Relation<ItineraryItem[]>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
