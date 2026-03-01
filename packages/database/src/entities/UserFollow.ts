import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./User";

@Entity("user_follows")
@Unique(["followerId", "followingId"])
export class UserFollow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "follower_id", type: "uuid" })
  followerId!: string;

  @Index()
  @Column({ name: "following_id", type: "uuid" })
  followingId!: string;

  @ManyToOne(() => User, (user) => user.following, { onDelete: "CASCADE" })
  @JoinColumn({ name: "follower_id" })
  follower!: Relation<User>;

  @ManyToOne(() => User, (user) => user.followers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "following_id" })
  followedUser!: Relation<User>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
