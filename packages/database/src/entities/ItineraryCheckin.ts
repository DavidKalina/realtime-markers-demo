import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./User";
import { Itinerary } from "./Itinerary";
import { ItineraryItem } from "./ItineraryItem";

@Entity("itinerary_checkins")
@Index(["userId", "itineraryId"])
export class ItineraryCheckin {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Index()
  @Column({ name: "itinerary_id", type: "uuid" })
  itineraryId!: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary!: Relation<Itinerary>;

  @Column({ name: "itinerary_item_id", type: "uuid" })
  itineraryItemId!: string;

  @ManyToOne(() => ItineraryItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_item_id" })
  itineraryItem!: Relation<ItineraryItem>;

  // User's actual coordinates at check-in time
  @Column({
    name: "user_latitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  userLatitude?: number;

  @Column({
    name: "user_longitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  userLongitude?: number;

  // Distance from user to venue at check-in (meters)
  @Column({
    name: "distance_meters",
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceMeters?: number;

  // The item's planned start time (denormalized for easy querying)
  @Column({ name: "planned_time", type: "varchar", length: 5, nullable: true })
  plannedTime?: string;

  // How the check-in was triggered
  @Column({
    name: "source",
    type: "varchar",
    length: 20,
    default: "'proximity'",
  })
  source!: string; // "proximity" | "manual"

  // Sort order of this item (denormalized for skip analysis)
  @Column({ name: "item_sort_order", type: "int" })
  itemSortOrder!: number;

  // IDs of items with lower sortOrder that were unchecked at this moment
  @Column({
    name: "skipped_item_ids",
    type: "uuid",
    array: true,
    default: "'{}'",
  })
  skippedItemIds!: string[];

  @CreateDateColumn({ name: "checked_in_at", type: "timestamptz" })
  checkedInAt!: Date;
}
