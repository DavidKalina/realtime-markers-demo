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
import { Sidequest } from "./Sidequest";
import type { UserPushToken } from "./UserPushToken";

type ReachMode = "local_only" | "nearby_mix" | "best_opportunities";

export interface BehavioralProfileV1 {
  summary: string;
  generatedAt: string;
  questCount: number;
  schemaVersion?: 1;
}

export interface BehavioralAggregates {
  completedCount: number;
  avgRating: number | null;
  topCategories: {
    category: string;
    count: number;
    avgRating: number | null;
  }[];
  topVenues: {
    venueName: string;
    count: number;
    avgRating: number | null;
    lastVisitedAt: string;
  }[];
  rejectedVenues: { name: string; category: string | null }[];
  travelRange: {
    medianMiles: number;
    maxMiles: number;
    recentMaxMiles: number;
  };
  anchors: string[];
}

export interface BehavioralProfileV2 {
  schemaVersion: 2;
  generatedAt: string;
  questCount: number;
  capabilityArc: string;
  categoryAffinity: string;
  venueAffinity: string;
  travelWillingness: string;
  blockerPattern: string;
  aggregates: BehavioralAggregates;
}

export function isBehavioralProfileV2(
  p: BehavioralProfileV1 | BehavioralProfileV2 | null | undefined,
): p is BehavioralProfileV2 {
  return !!p && (p as BehavioralProfileV2).schemaVersion === 2;
}

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

  @Column({ name: "total_xp", type: "integer", default: 0 })
  totalXp!: number;

  @Column({
    name: "current_tier",
    type: "varchar",
    length: 20,
    default: "Explorer",
  })
  currentTier!: string;

  @Column({ name: "current_streak", type: "integer", default: 0 })
  currentStreak!: number;

  @Column({ name: "longest_streak", type: "integer", default: 0 })
  longestStreak!: number;

  @Column({ name: "last_streak_week", type: "date", nullable: true })
  lastStreakWeek?: string;

  @Column({ name: "contacts", type: "jsonb", nullable: true })
  contacts?: {
    email?: string;
    phone?: string;
    name?: string;
    lastImportedAt?: Date;
  }[];

  @OneToMany("UserPushToken", "user")
  pushTokens!: Relation<UserPushToken>[];

  @Column({ name: "onboarding_profile", type: "jsonb", nullable: true })
  onboardingProfile?: {
    activities: string[];
    pace: string;
  };

  @Column({
    name: "home_latitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  homeLatitude?: number;

  @Column({
    name: "home_longitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  homeLongitude?: number;

  @Column({
    name: "comfort_radius_miles",
    type: "numeric",
    precision: 5,
    scale: 1,
    nullable: true,
  })
  comfortRadiusMiles?: number;

  @Column({
    name: "pace_preference",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  pacePreference?: string;

  @Column({
    name: "reach_mode",
    type: "varchar",
    length: 32,
    nullable: true,
  })
  reachMode?: ReachMode | null;

  @Column({ name: "comfort_profile", type: "jsonb", nullable: true })
  comfortProfile?: {
    comfortZone: string;
    barriers: string;
    goals: string;
    goalKey?: string;
    goalTags?: string[];
    primaryGoal?: string;
  };

  @Column({ name: "fear_ladder", type: "jsonb", nullable: true })
  fearLadder?: {
    overallScore: number;
    dimensionScores: Record<string, number>;
    responses: Record<string, number>;
    scenarios?: { id: string; text: string; dimension: string }[];
    dimensions?: string[];
  };

  @Column({ name: "behavioral_profile", type: "jsonb", nullable: true })
  behavioralProfile?: BehavioralProfileV2 | BehavioralProfileV1;

  @Column({ name: "ai_focus", type: "jsonb", nullable: true })
  aiFocus?: {
    summary: string;
    generatedAt: string;
  };

  @Column({ name: "social_situation", type: "jsonb", nullable: true })
  socialSituation?: {
    ageRange: string;
    gender: string;
    timeInArea: string;
    currentSocialLife: string;
    lookingFor: string[];
    workSituation: string;
    livingSituation: string;
    dailyRoutine?: string;
    transportation?: string;
    budget?: string;
  };

  /**
   * User-level venue quality preferences. Merged with policy-derived qualities
   * at prescription time; user `avoid` always wins. Surfacing here so the
   * filter is durable across sessions and can be edited from settings later.
   */
  @Column({ name: "venue_qualities", type: "jsonb", nullable: true })
  venueQualities?: {
    must?: string[];
    prefer?: string[];
    avoid?: string[];
  };

  @Column({ name: "active_sidequest_id", type: "uuid", nullable: true })
  activeSidequestId?: string;

  @ManyToOne(() => Sidequest, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "active_sidequest_id" })
  activeSidequest?: Relation<Sidequest>;

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

  @Column({ name: "onboarding_phase", type: "integer", default: 0 })
  onboardingPhase!: number;

  @Column({ name: "expectancy_calibration", type: "jsonb", nullable: true })
  expectancyCalibration?: {
    totalViolations: number;
    avgAnxietyDelta: number;
    avgDifficultyDelta: number;
    recentViolations: {
      anxietyDelta: number;
      difficultyDelta: number;
      at: string;
    }[];
    updatedAt: string;
  };
}
