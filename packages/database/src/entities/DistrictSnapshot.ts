import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { District } from "./District";

@Entity("district_snapshots")
@Index("IDX_ds_district_computed", ["districtId", "computedAt"])
export class DistrictSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "district_id", type: "uuid" })
  districtId!: string;

  @ManyToOne(() => District, { onDelete: "CASCADE" })
  @JoinColumn({ name: "district_id" })
  district!: Relation<District>;

  @Column({ name: "itinerary_count", type: "integer" })
  itineraryCount!: number;

  @Column({ name: "unique_explorers", type: "integer", default: 0 })
  uniqueExplorers!: number;

  @Column({ name: "weekly_adoptions", type: "integer", default: 0 })
  weeklyAdoptions!: number;

  @Column({ name: "weekly_new_itineraries", type: "integer", default: 0 })
  weeklyNewItineraries!: number;

  @Column({
    name: "avg_rating",
    type: "numeric",
    precision: 3,
    scale: 2,
    default: 0,
  })
  avgRating!: number;

  @CreateDateColumn({ name: "computed_at", type: "timestamptz" })
  computedAt!: Date;
}
