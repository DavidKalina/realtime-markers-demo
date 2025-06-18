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
import { Event } from "./Event";

@Entity("user_event_views")
@Unique(["userId", "eventId"]) // Ensure a user can only view an event once (for tracking purposes)
export class UserEventView {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @ManyToOne(() => User, (user) => user.viewedEvents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @ManyToOne(() => Event, (event) => event.views, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Relation<Event>;

  @Index(["userId", "viewedAt"])
  @CreateDateColumn({ name: "viewed_at", type: "timestamptz" })
  viewedAt!: Date;
}
