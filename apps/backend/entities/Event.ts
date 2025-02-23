// entities/Event.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { type Point } from "geojson";
import { Category } from "./Category";
import { ThirdSpace } from "./ThirdSpace";

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

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "event_date", type: "timestamptz" })
  eventDate!: Date;

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

  @ManyToOne(() => ThirdSpace, (space) => space.events)
  thirdSpace?: ThirdSpace;

  @ManyToMany(() => Category)
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
