import { Entity, Column, ManyToMany, JoinTable, OneToMany } from "typeorm";
import { Event } from "./Event";
import { User } from "./User";
import { Category } from "./Category";
import { UserEventSave } from "./UserEventSave";

export enum PrivateEventStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

@Entity("private_events")
export class PrivateEvent extends Event {
  @Column({
    type: "enum",
    enum: PrivateEventStatus,
    default: PrivateEventStatus.DRAFT,
  })
  privateStatus!: PrivateEventStatus;

  @Column({ type: "boolean", default: false })
  isProcessedByAI!: boolean;

  @Column({ type: "text", nullable: true })
  imageUrl?: string;

  @Column({ type: "text", nullable: true })
  imageDescription?: string;

  @Column({ type: "boolean", default: false })
  isImageProcessed!: boolean;

  // Many-to-many relationship with invited users
  @ManyToMany(() => User)
  @JoinTable({
    name: "private_event_invites",
    joinColumn: { name: "event_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  invitedUsers!: User[];

  // Many-to-many relationship with categories
  @ManyToMany(() => Category)
  @JoinTable({
    name: "private_event_categories",
    joinColumn: { name: "event_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "category_id", referencedColumnName: "id" },
  })
  declare categories: Category[];

  // Save relationship
  @OneToMany(() => UserEventSave, (save) => save.event)
  declare saves: UserEventSave[];
}
