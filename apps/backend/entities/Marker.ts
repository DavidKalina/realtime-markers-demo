// entities/Marker.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  ManyToOne,
} from "typeorm";
import { type Point } from "geojson";
import { Category } from "./Category";
import { FlyerImage } from "./FlyerImage";

@Entity("markers")
export class Marker {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    name: "location",
    nullable: false,
  })
  location!: Point;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "event_date", type: "timestamptz", nullable: true })
  eventDate?: Date;

  @Column({ name: "event_location", type: "varchar", nullable: true })
  eventLocation?: string;

  @Column({ name: "contact_info", type: "varchar", nullable: true })
  contactInfo?: string;

  @Column({ type: "varchar", length: 10 })
  emoji!: string;

  @Column({ type: "varchar", length: 10 })
  color!: string;

  @Column({ name: "flyer_id", type: "uuid", nullable: true })
  flyerId?: string;

  @ManyToOne(() => FlyerImage, (flyer) => flyer.markers)
  sourceFlyer?: FlyerImage;

  @Column({ type: "varchar", nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt?: Date;

  @Column({ name: "is_verified", type: "boolean", default: false })
  isVerified!: boolean;

  @Column({ name: "report_count", type: "integer", default: 0 })
  reportCount!: number;

  @ManyToMany(() => Category, (category) => category.markers)
  @JoinTable({
    name: "marker_categories",
    joinColumn: { name: "marker_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "category_id", referencedColumnName: "id" },
  })
  categories!: Category[];
}
