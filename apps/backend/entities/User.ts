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
import { Event } from "./Event";
import { UserEventDiscovery } from "./UserEventDiscovery";
import { UserEventSave } from "./UserEventSave";
import { UserLevel } from "./UserLevel";

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

  @Column({ type: "varchar", select: false })
  passwordHash!: string;

  @Column({ type: "varchar", nullable: true })
  displayName?: string;

  @Column({ type: "varchar", nullable: true })
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

  @Column({ name: "weekly_scan_count", type: "integer", default: 0 })
  weeklyScanCount!: number;

  @Column({ name: "last_scan_reset", type: "timestamptz", nullable: true })
  lastScanReset?: Date;

  @Column({ name: "total_xp", type: "integer", default: 0 })
  totalXp!: number;

  @Column({ name: "current_title", type: "varchar", nullable: true })
  currentTitle?: string;

  @OneToMany(() => UserLevel, (userLevel) => userLevel.user)
  userLevels!: UserLevel[];

  @OneToMany(() => UserEventDiscovery, (discovery) => discovery.user)
  discoveries!: UserEventDiscovery[];

  @OneToMany(() => Event, (event) => event.creator)
  createdEvents!: Event[];

  // Saves relationship
  @OneToMany(() => UserEventSave, (save) => save.user)
  savedEvents!: UserEventSave[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Optional: Add refresh token for auth if needed
  @Column({ name: "refresh_token", type: "varchar", nullable: true, select: false })
  refreshToken?: string;
}
