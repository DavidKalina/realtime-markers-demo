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
import { type Point } from "geojson";
import { User } from "./User";

export enum CivicEngagementType {
  POSITIVE_FEEDBACK = "POSITIVE_FEEDBACK",
  NEGATIVE_FEEDBACK = "NEGATIVE_FEEDBACK",
  IDEA = "IDEA",
}

export enum CivicEngagementStatus {
  PENDING = "PENDING",
  IN_REVIEW = "IN_REVIEW",
  IMPLEMENTED = "IMPLEMENTED",
  CLOSED = "CLOSED",
}

@Entity("civic_engagements")
export class CivicEngagement {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "creator_id", type: "uuid" })
  creatorId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator!: Relation<User>;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Index()
  @Column({
    type: "enum",
    enum: CivicEngagementType,
  })
  type!: CivicEngagementType;

  @Index()
  @Column({
    type: "enum",
    enum: CivicEngagementStatus,
    default: CivicEngagementStatus.PENDING,
  })
  status!: CivicEngagementStatus;

  // Location data (similar to Event entity)
  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: true,
  })
  location?: Point;

  @Index()
  @Column({ type: "text", nullable: true })
  address?: string;

  @Column({ type: "text", nullable: true, name: "location_notes" })
  locationNotes?: string;

  // Media attachments
  @Column({ type: "jsonb", nullable: true, name: "image_urls" })
  imageUrls?: string[];

  // Admin fields
  @Column({ type: "text", nullable: true, name: "admin_notes" })
  adminNotes?: string;

  @Column({ type: "timestamptz", nullable: true, name: "implemented_at" })
  implementedAt?: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
