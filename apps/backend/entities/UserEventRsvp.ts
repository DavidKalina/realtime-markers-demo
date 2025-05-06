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
import { User } from "./User";
import { Event } from "./Event";

export enum RsvpStatus {
  GOING = "GOING",
  NOT_GOING = "NOT_GOING",
}

@Entity("user_event_rsvps")
@Unique(["userId", "eventId"]) // Ensure a user can only have one RSVP status per event
export class UserEventRsvp {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Column({
    type: "enum",
    enum: RsvpStatus,
    default: RsvpStatus.GOING,
  })
  status!: RsvpStatus;

  @ManyToOne(() => User, (user) => user.rsvps, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Event, (event) => event.rsvps, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Event;

  @Index(["userId", "createdAt"])
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @CreateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
