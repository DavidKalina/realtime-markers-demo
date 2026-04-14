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

@Entity("user_push_tokens")
@Index(["userId", "token"], { unique: true })
@Index(["token"])
@Index(["isActive"])
export class UserPushToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ type: "text", nullable: false })
  token!: string;

  @Column({ name: "device_info", type: "jsonb", nullable: true })
  deviceInfo: Record<string, unknown> | null = null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "last_used_at", type: "timestamp", nullable: true })
  lastUsedAt: Date | null = null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean = true;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // Relations
  @ManyToOne("User", "pushTokens", { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: any;
}
