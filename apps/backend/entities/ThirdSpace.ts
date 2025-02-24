import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { type Point } from "geojson";
import { Event } from "./Event";

export enum ThirdSpaceStatus {
  BRONZE = "bronze",
  SILVER = "silver",
  GOLD = "gold",
  PLATINUM = "platinum",
}

@Entity("third_spaces")
export class ThirdSpace {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: false,
  })
  location!: Point;

  @Column({
    type: "enum",
    enum: ThirdSpaceStatus,
    nullable: true,
  })
  status?: ThirdSpaceStatus;

  @Column({ name: "event_count", type: "integer", default: 0 })
  eventCount!: number;

  @Column({ name: "diversity_score", type: "float", nullable: true })
  diversityScore?: number;

  @OneToMany(() => Event, (event) => event.thirdSpace)
  events!: Event[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
