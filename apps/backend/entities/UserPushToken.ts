import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./User";

export enum DeviceType {
  IOS = "ios",
  ANDROID = "android",
  WEB = "web",
}

@Entity("user_push_tokens")
export class UserPushToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", unique: true })
  token!: string;

  @Index()
  @Column({
    name: "device_type",
    type: "enum",
    enum: DeviceType,
  })
  deviceType!: DeviceType;

  @Column({ name: "device_id", type: "varchar", nullable: true })
  deviceId?: string;

  @Column({ name: "app_version", type: "varchar", nullable: true })
  appVersion?: string;

  @Column({ name: "os_version", type: "varchar", nullable: true })
  osVersion?: string;

  @Index()
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.pushTokens)
  user!: Relation<User>;
}
