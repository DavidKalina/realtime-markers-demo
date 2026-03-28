import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("districts")
export class District {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 200 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Index()
  @Column({ type: "varchar", length: 12 })
  geohash!: string;

  @Column({
    name: "centroid_lat",
    type: "numeric",
    precision: 10,
    scale: 7,
  })
  centroidLat!: number;

  @Column({
    name: "centroid_lng",
    type: "numeric",
    precision: 10,
    scale: 7,
  })
  centroidLng!: number;

  @Column({ name: "embedding_centroid", type: "text", nullable: true })
  embeddingCentroid?: string;

  @Column({
    name: "activity_tags",
    type: "text",
    array: true,
    default: "{}",
  })
  activityTags!: string[];

  @Column({
    name: "avg_rating",
    type: "numeric",
    precision: 3,
    scale: 2,
    default: 0,
  })
  avgRating!: number;

  @Column({ name: "total_adoptions", type: "int", default: 0 })
  totalAdoptions!: number;

  @Index()
  @Column({ type: "varchar", length: 20, default: "active" })
  status!: string;

  @Column({ name: "last_clustered_at", type: "timestamptz", nullable: true })
  lastClusteredAt?: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
