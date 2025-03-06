// entities/User.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { UserEventDiscovery } from "./UserEventDiscovery";
import { Event } from "./Event";

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

  @Column({ name: "is_verified", type: "boolean", default: false })
  isVerified!: boolean;

  @Column({ name: "discovery_count", type: "integer", default: 0 })
  discoveryCount!: number;

  @Column({ name: "scan_count", type: "integer", default: 0 })
  scanCount!: number;

  @OneToMany(() => UserEventDiscovery, (discovery) => discovery.user)
  discoveries!: UserEventDiscovery[];

  @OneToMany(() => Event, (event) => event.creator)
  createdEvents!: Event[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Optional: Add refresh token for auth if needed
  @Column({ name: "refresh_token", type: "varchar", nullable: true, select: false })
  refreshToken?: string;
}
