import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  type Relation,
} from "typeorm";
import { District } from "./District";
import { Itinerary } from "./Itinerary";

@Entity("district_itineraries")
@Unique(["districtId", "itineraryId"])
export class DistrictItinerary {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "district_id", type: "uuid" })
  districtId!: string;

  @ManyToOne(() => District, (d) => d.districtItineraries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "district_id" })
  district!: Relation<District>;

  @Index()
  @Column({ name: "itinerary_id", type: "uuid" })
  itineraryId!: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary!: Relation<Itinerary>;

  @Column({
    type: "numeric",
    precision: 4,
    scale: 3,
    nullable: true,
  })
  similarity?: number;

  @CreateDateColumn({ name: "added_at", type: "timestamptz" })
  addedAt!: Date;
}
