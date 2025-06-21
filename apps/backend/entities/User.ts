// entities/User.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import { Event } from "./Event";
import { UserEventDiscovery } from "./UserEventDiscovery";
import { UserEventSave } from "./UserEventSave";
import { UserEventView } from "./UserEventView";
import { UserEventRsvp } from "./UserEventRsvp";

export enum UserRole {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}

export enum PlanType {
  FREE = "FREE",
  PRO = "PRO",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ name: "first_name", type: "varchar", nullable: true })
  firstName?: string;

  @Column({ name: "last_name", type: "varchar", nullable: true })
  lastName?: string;

  @Index({ unique: true })
  @Column({ name: "username", type: "varchar", unique: true, nullable: true })
  username?: string;

  @Column({ type: "varchar", nullable: true })
  phone?: string;

  @Column({ name: "password_hash", type: "varchar", select: false })
  passwordHash!: string;

  @Column({ name: "display_name", type: "varchar", nullable: true })
  displayName?: string;

  @Column({ name: "avatar_url", type: "varchar", nullable: true })
  avatarUrl?: string;

  @Column({ type: "text", nullable: true })
  bio?: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    name: "plan_type",
    type: "enum",
    enum: PlanType,
    default: PlanType.FREE,
  })
  planType!: PlanType;

  @Column({ name: "is_verified", type: "boolean", default: false })
  isVerified!: boolean;

  @Column({ name: "discovery_count", type: "integer", default: 0 })
  discoveryCount!: number;

  @Column({ name: "scan_count", type: "integer", default: 0 })
  scanCount!: number;

  @Column({ name: "save_count", type: "integer", default: 0 })
  saveCount!: number;

  @Column({ name: "view_count", type: "integer", default: 0 })
  viewCount!: number;

  @Column({ name: "weekly_scan_count", type: "integer", default: 0 })
  weeklyScanCount!: number;

  @Column({ name: "last_scan_reset", type: "timestamptz", nullable: true })
  lastScanReset?: Date;

  @Column({ name: "contacts", type: "jsonb", nullable: true })
  contacts?: {
    email?: string;
    phone?: string;
    name?: string;
    lastImportedAt?: Date;
  }[];

  @OneToMany(() => UserEventDiscovery, (discovery) => discovery.user)
  discoveries!: Relation<UserEventDiscovery>[];

  @OneToMany(() => Event, (event) => event.creator)
  createdEvents!: Relation<Event>[];

  @OneToMany(() => UserEventSave, (save) => save.user)
  savedEvents!: Relation<UserEventSave>[];

  @OneToMany(() => UserEventView, (view) => view.user)
  viewedEvents!: Relation<UserEventView>[];

  @OneToMany(() => UserEventRsvp, (rsvp) => rsvp.user)
  rsvps!: Relation<UserEventRsvp>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Optional: Add refresh token for auth if needed
  @Column({
    name: "refresh_token",
    type: "varchar",
    nullable: true,
    select: false,
  })
  refreshToken?: string;
}
