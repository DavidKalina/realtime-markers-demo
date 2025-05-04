import { type Point } from "geojson";
import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Category } from "./Category";
import { User } from "./User";
import { UserEventSave } from "./UserEventSave";

@Entity("private_events")
export class PrivateEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", default: "📍" })
  emoji?: string;

  @Column({ type: "varchar", nullable: true, name: "emoji_description" })
  emojiDescription?: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "event_date", type: "timestamptz" })
  date!: Date;

  @Column({ type: "varchar", nullable: true, default: "UTC" })
  timezone?: string;

  @Column({ type: "text", nullable: true })
  address?: string;

  @Column({ type: "text", nullable: true, name: "location_notes" })
  locationNotes?: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: false,
  })
  location!: Point;

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
  categories!: Category[];

  // Save relationship
  @OneToMany(() => UserEventSave, (save) => save.event)
  saves!: UserEventSave[];
}
