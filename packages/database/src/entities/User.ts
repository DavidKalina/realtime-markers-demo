// entities/User.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import { Itinerary } from "./Itinerary";
import type { Event } from "./Event";
import type { UserEventDiscovery } from "./UserEventDiscovery";
import type { UserEventRsvp } from "./UserEventRsvp";
import type { UserEventSave } from "./UserEventSave";
import type { UserEventView } from "./UserEventView";
import type { UserFollow } from "./UserFollow";
import type { UserPushToken } from "./UserPushToken";

export enum UserRole {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
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

  @Column({ type: "varchar", nullable: true })
  phone?: string;

  @Column({ name: "password_hash", type: "varchar", nullable: true })
  passwordHash?: string;

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

  @Column({ name: "total_xp", type: "integer", default: 0 })
  totalXp!: number;

  @Column({
    name: "current_tier",
    type: "varchar",
    length: 20,
    default: "Explorer",
  })
  currentTier!: string;

  @Column({ name: "weekly_scan_count", type: "integer", default: 0 })
  weeklyScanCount!: number;

  @Column({ name: "last_scan_reset", type: "timestamptz", nullable: true })
  lastScanReset?: Date;

  @Column({ name: "current_streak", type: "integer", default: 0 })
  currentStreak!: number;

  @Column({ name: "longest_streak", type: "integer", default: 0 })
  longestStreak!: number;

  @Column({ name: "last_streak_week", type: "date", nullable: true })
  lastStreakWeek?: string;

  @Column({ name: "follower_count", type: "integer", default: 0 })
  followerCount!: number;

  @Column({ name: "following_count", type: "integer", default: 0 })
  followingCount!: number;

  @Column({ name: "contacts", type: "jsonb", nullable: true })
  contacts?: {
    email?: string;
    phone?: string;
    name?: string;
    lastImportedAt?: Date;
  }[];

  @OneToMany("UserPushToken", "user")
  pushTokens!: Relation<UserPushToken>[];

  @OneToMany("Event", "creator")
  createdEvents!: Relation<Event>[];

  @OneToMany("UserEventDiscovery", "user")
  discoveries!: Relation<UserEventDiscovery>[];

  @OneToMany("UserEventRsvp", "user")
  rsvps!: Relation<UserEventRsvp>[];

  @OneToMany("UserEventSave", "user")
  savedEvents!: Relation<UserEventSave>[];

  @OneToMany("UserEventView", "user")
  viewedEvents!: Relation<UserEventView>[];

  @OneToMany("UserFollow", "follower")
  following!: Relation<UserFollow>[];

  @OneToMany("UserFollow", "following")
  followers!: Relation<UserFollow>[];

  @Column({ name: "preference_embedding", type: "text", nullable: true })
  preferenceEmbedding?: string;

  @Column({ name: "onboarding_profile", type: "jsonb", nullable: true })
  onboardingProfile?: {
    activities: string[];
    vibes: string[];
    idealDay: string;
    pace: string;
  };

  @Column({ name: "active_itinerary_id", type: "uuid", nullable: true })
  activeItineraryId?: string;

  @ManyToOne(() => Itinerary, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "active_itinerary_id" })
  activeItinerary?: Relation<Itinerary>;

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

  @Column({
    name: "password_reset_token",
    type: "varchar",
    nullable: true,
    select: false,
  })
  passwordResetToken?: string;

  @Column({
    name: "password_reset_expires_at",
    type: "timestamptz",
    nullable: true,
    select: false,
  })
  passwordResetExpiresAt?: Date;
}
