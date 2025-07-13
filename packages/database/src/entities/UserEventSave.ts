// entities/UserEventSave.ts

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

@Entity("user_event_saves")
@Unique(["userId", "eventId"]) // Ensure a user can only save an event once
export class UserEventSave {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @ManyToOne(() => User, (user) => user.savedEvents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @ManyToOne(() => Event, (event) => event.saves, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Relation<Event>;

  @Index(["userId", "savedAt"])
  @CreateDateColumn({ name: "saved_at", type: "timestamptz" })
  savedAt!: Date;
}
