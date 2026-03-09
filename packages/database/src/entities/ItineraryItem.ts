import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { Itinerary } from "./Itinerary";
import { Event } from "./Event";

@Entity("itinerary_items")
export class ItineraryItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "itinerary_id", type: "uuid" })
  itineraryId!: string;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "itinerary_id" })
  itinerary!: Relation<Itinerary>;

  @Column({ name: "sort_order", type: "int" })
  sortOrder!: number;

  @Column({ name: "start_time", type: "varchar", length: 5 })
  startTime!: string; // "14:00"

  @Column({ name: "end_time", type: "varchar", length: 5 })
  endTime!: string; // "15:30"

  @Column({ type: "varchar", length: 500 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  emoji?: string;

  @Column({
    name: "estimated_cost",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedCost?: number;

  @Column({ name: "venue_name", type: "varchar", length: 500, nullable: true })
  venueName?: string;

  @Column({
    name: "venue_address",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  venueAddress?: string;

  @Column({ name: "event_id", type: "uuid", nullable: true })
  eventId?: string;

  @ManyToOne(() => Event, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "event_id" })
  event?: Relation<Event>;

  @Column({ type: "text", nullable: true, name: "travel_note" })
  travelNote?: string; // "10 min walk" between stops

  @Column({ type: "numeric", precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: "numeric", precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({
    name: "google_place_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  googlePlaceId?: string;

  @Column({
    name: "google_rating",
    type: "numeric",
    precision: 2,
    scale: 1,
    nullable: true,
  })
  googleRating?: number;

  @Column({
    name: "venue_category",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  venueCategory?: string;

  @Column({ name: "why_this_stop", type: "text", nullable: true })
  whyThisStop?: string;

  @Column({ name: "pro_tip", type: "text", nullable: true })
  proTip?: string;

  @Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
  checkedInAt?: Date;
}
