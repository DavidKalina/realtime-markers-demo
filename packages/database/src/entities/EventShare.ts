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
import type { Relation } from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity("event_shares")
@Index(["eventId", "sharedWithId"], { unique: true })
export class EventShare {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Column({ name: "shared_with_id", type: "uuid" })
  sharedWithId!: string;

  @Column({ name: "shared_by_id", type: "uuid" })
  sharedById!: string;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Relation<Event>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shared_with_id" })
  sharedWith!: Relation<User>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shared_by_id" })
  sharedBy!: Relation<User>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
