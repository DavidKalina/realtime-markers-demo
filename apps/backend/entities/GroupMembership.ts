// entities/GroupMembership.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "./User";
import { Group } from "./Group";

export enum GroupMemberRole {
  MEMBER = "MEMBER",
  ADMIN = "ADMIN",
  // OWNER is implicitly defined by Group.ownerId, but you might want it here for easier role checks
  // Or, the owner will also have an ADMIN record. For simplicity, we'll keep owner separate on the Group.
}

export enum GroupMembershipStatus {
  PENDING = "PENDING", // For private groups requiring approval
  APPROVED = "APPROVED",
  REJECTED = "REJECTED", // If a join request was rejected
  BANNED = "BANNED",
  // INVITED = "INVITED", // If a user was invited but hasn't accepted yet
}

@Entity("group_memberships")
@Unique(["userId", "groupId"]) // A user can only have one membership record per group
export class GroupMembership {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Index()
  @Column({ name: "group_id", type: "uuid" })
  groupId!: string;

  @Column({
    type: "enum",
    enum: GroupMemberRole,
    default: GroupMemberRole.MEMBER,
  })
  role!: GroupMemberRole;

  @Column({
    type: "enum",
    enum: GroupMembershipStatus,
    default: GroupMembershipStatus.APPROVED, // Or PENDING if default join requires approval
  })
  status!: GroupMembershipStatus;

  @ManyToOne(() => User, (user) => user.groupMemberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Group, (group) => group.memberships, { onDelete: "CASCADE" })
  @JoinColumn({ name: "group_id" })
  group!: Group;

  @CreateDateColumn({ name: "joined_at", type: "timestamptz" })
  joinedAt!: Date; // When the membership became active (or requested)

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
