// entities/Event.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
  JoinColumn,
  Index,
} from "typeorm";
import { type Point } from "geojson";
import { Category } from "./Category";
import { User } from "./User";
import { UserEventDiscovery } from "./UserEventDiscovery";
import { UserEventSave } from "./UserEventSave";

export enum EventStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", default: "📍" })
  emoji?: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Index()
  @Column({ name: "event_date", type: "timestamptz" })
  eventDate!: Date;

  @Index()
  @Column({ type: "text", nullable: true })
  address?: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: false,
  })
  location!: Point;

  @Column({ name: "scan_count", type: "integer", default: 1 })
  scanCount!: number;

  @Column({ name: "save_count", type: "integer", default: 0 })
  saveCount!: number;

  @Column({ name: "confidence_score", type: "float", nullable: true })
  confidenceScore?: number;

  @Column({ name: "embedding", type: "text", nullable: true })
  embedding?: string;

  @Column({
    type: "enum",
    enum: EventStatus,
    default: EventStatus.PENDING,
  })
  status!: EventStatus;

  // Link to creator user
  @Column({ name: "creator_id", type: "uuid", nullable: true })
  creatorId?: string;

  @ManyToOne(() => User, (user) => user.createdEvents, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "creator_id" })
  creator?: User;

  // Discovery relationship
  @OneToMany(() => UserEventDiscovery, (discovery) => discovery.event)
  discoveries!: UserEventDiscovery[];

  // Save relationship
  @OneToMany(() => UserEventSave, (save) => save.event)
  saves!: UserEventSave[];

  @ManyToMany(() => Category, (category) => category.events)
  @JoinTable({
    name: "event_categories",
    joinColumn: { name: "event_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "category_id", referencedColumnName: "id" },
  })
  categories!: Category[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
