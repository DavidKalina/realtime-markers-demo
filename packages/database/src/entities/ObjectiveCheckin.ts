import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { User } from "./User";
import { Sidequest } from "./Sidequest";
import { Objective } from "./Objective";

@Entity("objective_checkins")
@Index(["userId", "sidequestId"])
export class ObjectiveCheckin {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Index()
  @Column({ name: "sidequest_id", type: "uuid" })
  sidequestId!: string;

  @ManyToOne(() => Sidequest, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sidequest_id" })
  sidequest!: Relation<Sidequest>;

  @Column({ name: "objective_id", type: "uuid" })
  objectiveId!: string;

  @ManyToOne(() => Objective, { onDelete: "CASCADE" })
  @JoinColumn({ name: "objective_id" })
  objective!: Relation<Objective>;

  @Column({
    name: "user_latitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  userLatitude?: number;

  @Column({
    name: "user_longitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  userLongitude?: number;

  @Column({
    name: "distance_meters",
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceMeters?: number;

  @Column({
    name: "source",
    type: "varchar",
    length: 20,
    default: () => "'proximity'",
  })
  source!: string; // "proximity" | "manual"

  @Column({ name: "objective_sort_order", type: "int" })
  objectiveSortOrder!: number;

  @Column({
    name: "skipped_objective_ids",
    type: "uuid",
    array: true,
    default: () => "'{}'",
  })
  skippedObjectiveIds!: string[];

  @CreateDateColumn({ name: "checked_in_at", type: "timestamptz" })
  checkedInAt!: Date;
}
