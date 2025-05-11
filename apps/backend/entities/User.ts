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
import { Friendship } from "./Friendship";
import { UserEventDiscovery } from "./UserEventDiscovery";
import { UserEventSave } from "./UserEventSave";
import { UserLevel } from "./UserLevel";
import { UserEventRsvp } from "./UserEventRsvp";
import { Group } from "./Group";
import { GroupMembership } from "./GroupMembership";

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

  @Index({ unique: true })
  @Column({ name: "username", type: "varchar", unique: true, nullable: true })
  username?: string;

  @Index({ unique: true })
  @Column({ name: "friend_code", type: "varchar", unique: true, nullable: true })
  friendCode?: string;

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

  @Column({ name: "weekly_scan_count", type: "integer", default: 0 })
  weeklyScanCount!: number;

  @Column({ name: "last_scan_reset", type: "timestamptz", nullable: true })
  lastScanReset?: Date;

  @Column({ name: "total_xp", type: "integer", default: 0 })
  totalXp!: number;

  @Column({ name: "current_title", type: "varchar", nullable: true })
  currentTitle?: string;

  @Column({ name: "contacts", type: "jsonb", nullable: true })
  contacts?: {
    email?: string;
    phone?: string;
    name?: string;
    lastImportedAt?: Date;
  }[];

  @OneToMany(() => UserLevel, (userLevel) => userLevel.user)
  userLevels!: UserLevel[];

  @OneToMany(() => UserEventDiscovery, (discovery) => discovery.user)
  discoveries!: UserEventDiscovery[];

  @OneToMany(() => Event, (event) => event.creator)
  createdEvents!: Event[];

  @OneToMany(() => UserEventSave, (save) => save.user)
  savedEvents!: UserEventSave[];

  @OneToMany(() => UserEventRsvp, (rsvp) => rsvp.user)
  rsvps!: UserEventRsvp[];

  // Friendship relationships
  @OneToMany(() => Friendship, (friendship) => friendship.requester)
  sentFriendRequests!: Friendship[];

  @OneToMany(() => Friendship, (friendship) => friendship.addressee)
  receivedFriendRequests!: Friendship[];

  @OneToMany(() => Group, (group) => group.owner)
  ownedGroups!: Group[];

  // Memberships this user has in various groups
  @OneToMany(() => GroupMembership, (membership) => membership.user)
  groupMemberships!: GroupMembership[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Optional: Add refresh token for auth if needed
  @Column({ name: "refresh_token", type: "varchar", nullable: true, select: false })
  refreshToken?: string;
}
