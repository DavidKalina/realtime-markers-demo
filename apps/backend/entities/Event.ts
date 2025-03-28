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
  @Column({ name: "end_date", type: "timestamptz", nullable: true })
  endDate?: Date;

  @Column({ type: "varchar", nullable: true, default: "UTC" })
  timezone?: string;

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

  @Column({ name: "qr_url", type: "text", nullable: true })
  qrUrl?: string;

  @Column({ name: "qr_code_data", type: "text", nullable: true })
  qrCodeData?: string;

  @Column({ name: "qr_image_path", type: "text", nullable: true })
  qrImagePath?: string;

  @Column({ name: "has_qr_code", type: "boolean", default: false })
  hasQrCode!: boolean;

  @Column({ name: "qr_generated_at", type: "timestamptz", nullable: true })
  qrGeneratedAt?: Date;

  // New fields for QR code detection
  @Column({ name: "qr_detected_in_image", type: "boolean", default: false })
  qrDetectedInImage!: boolean;

  @Column({ name: "detected_qr_data", type: "text", nullable: true })
  detectedQrData?: string;

  // In Event.ts
  @Column({ name: "original_image_url", type: "text", nullable: true })
  originalImageUrl?: string;

  @Column({ name: "update_count", type: "integer", default: 0 })
  updateCount!: number;

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
