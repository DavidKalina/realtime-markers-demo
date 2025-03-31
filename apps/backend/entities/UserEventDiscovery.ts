// entities/UserEventDiscovery.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity("user_event_discoveries")
@Index(["userId", "eventId"], { unique: true })
export class UserEventDiscovery {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index(["userId", "discoveredAt"])
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @ManyToOne(() => User, (user) => user.discoveries, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Event, (event) => event.discoveries, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Event;

  @Index()
  @CreateDateColumn({ name: "discovered_at", type: "timestamptz" })
  discoveredAt!: Date;
}
