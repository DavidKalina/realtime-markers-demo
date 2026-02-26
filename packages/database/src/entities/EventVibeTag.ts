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

export enum VibeTag {
  HIDDEN_GEM = "HIDDEN_GEM",
  BRING_FRIENDS = "BRING_FRIENDS",
  GREAT_FOR_SOLO = "GREAT_FOR_SOLO",
  CASH_ONLY = "CASH_ONLY",
  OUTDOOR = "OUTDOOR",
  KID_FRIENDLY = "KID_FRIENDLY",
  LOUD = "LOUD",
  CHILL = "CHILL",
}

@Entity("event_vibe_tags")
@Unique(["userId", "eventId", "tag"])
export class EventVibeTag {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Column({
    type: "enum",
    enum: VibeTag,
  })
  tag!: VibeTag;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Relation<Event>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
