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
