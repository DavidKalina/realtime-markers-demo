import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("coverage_clusters")
@Index(["userId"])
export class CoverageCluster {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({
    name: "latitude",
    type: "numeric",
    precision: 10,
    scale: 7,
  })
  latitude!: number;

  @Column({
    name: "longitude",
    type: "numeric",
    precision: 10,
    scale: 7,
  })
  longitude!: number;

  @Column({ name: "visit_count", type: "int", default: 1 })
  visitCount!: number;

  /**
   * Shade intensity: 1 - e^(-0.5 * visitCount)
   * Stored for fast reads; recomputed on each check-in.
   */
  @Column({
    name: "shade",
    type: "numeric",
    precision: 4,
    scale: 3,
    default: 0,
  })
  shade!: number;

  @Column({
    name: "venue_categories",
    type: "text",
    array: true,
    default: "{}",
  })
  venueCategories!: string[];

  @Column({ name: "last_visited_at", type: "timestamptz" })
  lastVisitedAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
