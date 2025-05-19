import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

export type NotificationType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "LEVEL_UP"
  | "ACHIEVEMENT_UNLOCKED"
  | "SYSTEM"
  | "EVENT_RSVP_TOGGLED";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: [
      "EVENT_CREATED",
      "EVENT_UPDATED",
      "EVENT_DELETED",
      "EVENT_RSVP_TOGGLED",
      "FRIEND_REQUEST",
      "FRIEND_ACCEPTED",
      "LEVEL_UP",
      "ACHIEVEMENT_UNLOCKED",
      "SYSTEM",
    ],
  })
  type!: NotificationType;

  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column("varchar")
  title!: string;

  @Column("text")
  message!: string;

  @Column("jsonb", { nullable: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @Column("boolean", { default: false })
  read!: boolean;

  @Column("timestamp", { nullable: true })
  readAt!: Date;
}
